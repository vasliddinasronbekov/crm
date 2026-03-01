"""
Subscription Signals for Automated Management

Handles:
- Revenue tracking on successful payments
- Invoice generation
- Subscription status updates
- Email notifications
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from decimal import Decimal
import logging

from .models import Payment, UserSubscription, Invoice, RevenueRecord

logger = logging.getLogger(__name__)


# ==================== Payment Signals ====================

@receiver(post_save, sender=Payment)
def handle_payment_success(sender, instance, created, **kwargs):
    """
    Handle successful payment:
    1. Create revenue record
    2. Generate invoice
    3. Update subscription status
    """
    if instance.status == 'succeeded' and not hasattr(instance, '_signal_handled'):
        instance._signal_handled = True

        # 1. Create Revenue Record
        try:
            if not hasattr(instance, 'revenue_record'):
                revenue_date = instance.succeeded_at or timezone.now()

                # Calculate fees (example: 2.9% + $0.30 for Stripe)
                fees = Decimal('0')
                if instance.payment_method.startswith('stripe'):
                    fees = (instance.amount * Decimal('0.029')) + Decimal('0.30')

                RevenueRecord.objects.create(
                    payment=instance,
                    revenue_type='subscription' if instance.subscription else 'one_time',
                    amount=instance.amount,
                    currency=instance.currency,
                    gross_amount=instance.amount,
                    fees=fees,
                    net_amount=instance.amount - fees,
                    revenue_date=revenue_date.date(),
                    revenue_month=revenue_date.month,
                    revenue_year=revenue_date.year
                )
                logger.info(f"Revenue record created for payment {instance.id}")
        except Exception as e:
            logger.error(f"Failed to create revenue record: {e}")

        # 2. Generate Invoice
        try:
            if instance.subscription and not hasattr(instance, 'invoice'):
                invoice = Invoice.objects.create(
                    user=instance.user,
                    subscription=instance.subscription,
                    payment=instance,
                    status='paid',
                    subtotal=instance.amount,
                    tax=Decimal('0'),
                    discount=Decimal('0'),
                    total=instance.amount,
                    currency=instance.currency,
                    line_items=[
                        {
                            'description': f'Subscription: {instance.subscription.plan.name}',
                            'amount': str(instance.amount),
                            'quantity': 1
                        }
                    ],
                    issue_date=timezone.now().date(),
                    due_date=timezone.now().date(),
                    paid_at=instance.succeeded_at or timezone.now()
                )
                logger.info(f"Invoice {invoice.invoice_number} created for payment {instance.id}")
        except Exception as e:
            logger.error(f"Failed to create invoice: {e}")

        # 3. Update Subscription Status
        if instance.subscription:
            try:
                subscription = instance.subscription
                if subscription.status in ['trialing', 'past_due']:
                    subscription.status = 'active'
                    subscription.save()
                    logger.info(f"Subscription {subscription.id} activated after successful payment")
            except Exception as e:
                logger.error(f"Failed to update subscription status: {e}")


@receiver(post_save, sender=Payment)
def handle_payment_failure(sender, instance, created, **kwargs):
    """
    Handle failed payment:
    1. Update subscription to past_due
    2. Send notification
    """
    if instance.status == 'failed' and instance.subscription and not hasattr(instance, '_failure_handled'):
        instance._failure_handled = True

        try:
            subscription = instance.subscription
            if subscription.status == 'active':
                subscription.status = 'past_due'
                subscription.save()
                logger.warning(f"Subscription {subscription.id} marked as past_due after payment failure")

                # TODO: Send email notification to user
                # send_payment_failure_email(subscription.user, instance)
        except Exception as e:
            logger.error(f"Failed to handle payment failure: {e}")


# ==================== Subscription Signals ====================

@receiver(pre_save, sender=UserSubscription)
def update_subscription_period(sender, instance, **kwargs):
    """
    Auto-update subscription billing period on renewal
    """
    if instance.pk:  # Only for existing subscriptions
        try:
            old_instance = UserSubscription.objects.get(pk=instance.pk)

            # Check if subscription is being renewed
            if (old_instance.current_period_end < timezone.now() and
                instance.status == 'active' and
                instance.auto_renew):

                # Calculate new billing period
                from datetime import timedelta

                if instance.plan.interval == 'monthly':
                    days = 30
                elif instance.plan.interval == 'quarterly':
                    days = 90
                elif instance.plan.interval == 'yearly':
                    days = 365
                else:
                    days = 30

                instance.current_period_start = timezone.now()
                instance.current_period_end = timezone.now() + timedelta(days=days)

                logger.info(f"Subscription {instance.id} billing period updated for renewal")
        except UserSubscription.DoesNotExist:
            pass


@receiver(post_save, sender=UserSubscription)
def handle_subscription_cancellation(sender, instance, created, **kwargs):
    """
    Handle subscription cancellation
    """
    if not created and instance.cancel_at_period_end and not hasattr(instance, '_cancel_handled'):
        instance._cancel_handled = True

        try:
            logger.info(f"Subscription {instance.id} will cancel at period end: {instance.current_period_end}")

            # TODO: Send cancellation confirmation email
            # send_subscription_cancellation_email(instance.user, instance)
        except Exception as e:
            logger.error(f"Failed to handle subscription cancellation: {e}")


@receiver(post_save, sender=UserSubscription)
def handle_trial_start(sender, instance, created, **kwargs):
    """
    Handle trial subscription start
    """
    if created and instance.status == 'trialing' and instance.trial_end:
        try:
            logger.info(f"Trial subscription {instance.id} started for user {instance.user.email}")

            # TODO: Send trial welcome email
            # send_trial_welcome_email(instance.user, instance)
        except Exception as e:
            logger.error(f"Failed to handle trial start: {e}")


# ==================== Invoice Signals ====================

@receiver(pre_save, sender=Invoice)
def generate_invoice_number(sender, instance, **kwargs):
    """
    Auto-generate invoice number if not set
    """
    if not instance.invoice_number:
        from datetime import datetime

        # Format: INV-YYYYMMDD-XXXXX
        today = datetime.now().strftime('%Y%m%d')

        # Get last invoice of the day
        last_invoice = Invoice.objects.filter(
            invoice_number__startswith=f'INV-{today}'
        ).order_by('-invoice_number').first()

        if last_invoice:
            # Extract sequence number and increment
            try:
                last_seq = int(last_invoice.invoice_number.split('-')[-1])
                new_seq = last_seq + 1
            except (ValueError, IndexError):
                new_seq = 1
        else:
            new_seq = 1

        instance.invoice_number = f'INV-{today}-{new_seq:05d}'
        logger.info(f"Generated invoice number: {instance.invoice_number}")


# ==================== Helper Functions ====================

def check_expired_subscriptions():
    """
    Celery task to check and expire old subscriptions
    Should be called daily via Celery Beat
    """
    from django.utils import timezone

    expired_subs = UserSubscription.objects.filter(
        status__in=['active', 'past_due'],
        current_period_end__lt=timezone.now(),
        auto_renew=False
    )

    count = 0
    for sub in expired_subs:
        sub.status = 'expired'
        sub.save()
        count += 1
        logger.info(f"Subscription {sub.id} expired")

    logger.info(f"Expired {count} subscriptions")
    return count


def process_subscription_renewals():
    """
    Celery task to process upcoming subscription renewals
    Should be called daily via Celery Beat
    """
    from datetime import timedelta
    from django.utils import timezone

    # Find subscriptions expiring in next 3 days
    upcoming = UserSubscription.objects.filter(
        status='active',
        auto_renew=True,
        current_period_end__lte=timezone.now() + timedelta(days=3),
        current_period_end__gt=timezone.now()
    )

    count = 0
    for sub in upcoming:
        try:
            # TODO: Create payment intent for renewal
            # For now, just log
            logger.info(f"Subscription {sub.id} renewing in {(sub.current_period_end - timezone.now()).days} days")
            count += 1
        except Exception as e:
            logger.error(f"Failed to process renewal for subscription {sub.id}: {e}")

    logger.info(f"Processed {count} upcoming renewals")
    return count

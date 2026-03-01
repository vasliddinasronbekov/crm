"""
Subscription Management Services

Advanced subscription features:
- Proration for plan changes
- Dunning management for failed payments
- Auto-renewal handling
"""

from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from typing import Tuple, Dict
import logging

from .models import UserSubscription, SubscriptionPlan, Payment, Invoice

logger = logging.getLogger(__name__)


# ==================== Proration Service ====================

class ProrationService:
    """
    Handle proration calculations for subscription plan changes
    """

    @staticmethod
    def calculate_proration(
        current_subscription: UserSubscription,
        new_plan: SubscriptionPlan
    ) -> Dict:
        """
        Calculate prorated amount when changing plans mid-cycle

        Returns dict with:
        - proration_credit: Unused time credit from current plan
        - new_plan_cost: Full cost of new plan
        - amount_due: Net amount due (can be negative if downgrade)
        - proration_details: Breakdown of calculation
        """

        now = timezone.now()
        current_plan = current_subscription.plan

        # Calculate remaining time in current period
        total_period_seconds = (
            current_subscription.current_period_end -
            current_subscription.current_period_start
        ).total_seconds()

        remaining_seconds = (
            current_subscription.current_period_end - now
        ).total_seconds()

        if total_period_seconds <= 0 or remaining_seconds <= 0:
            # No proration needed if at end of period
            return {
                'proration_credit': Decimal('0'),
                'new_plan_cost': new_plan.price,
                'amount_due': new_plan.price,
                'proration_details': {
                    'reason': 'No proration - at end of billing period'
                }
            }

        # Calculate prorated credit from current plan
        usage_ratio = Decimal(str(remaining_seconds / total_period_seconds))
        proration_credit = current_plan.price * usage_ratio

        # New plan cost (prorated for remaining period)
        new_plan_prorated = new_plan.price * usage_ratio

        # Amount due (positive if upgrade, negative if downgrade)
        amount_due = new_plan_prorated - proration_credit

        proration_details = {
            'current_plan': current_plan.name,
            'new_plan': new_plan.name,
            'current_plan_price': float(current_plan.price),
            'new_plan_price': float(new_plan.price),
            'period_start': current_subscription.current_period_start.isoformat(),
            'period_end': current_subscription.current_period_end.isoformat(),
            'remaining_days': int(remaining_seconds / 86400),
            'usage_percentage': float((1 - usage_ratio) * 100),
            'proration_credit': float(proration_credit),
            'new_plan_prorated_cost': float(new_plan_prorated),
            'amount_due': float(amount_due),
            'is_upgrade': new_plan.price > current_plan.price,
            'is_downgrade': new_plan.price < current_plan.price
        }

        return {
            'proration_credit': proration_credit,
            'new_plan_cost': new_plan_prorated,
            'amount_due': amount_due,
            'proration_details': proration_details
        }

    @staticmethod
    @transaction.atomic
    def change_plan(
        subscription: UserSubscription,
        new_plan: SubscriptionPlan,
        immediate: bool = True
    ) -> Tuple[bool, Dict]:
        """
        Change subscription plan with proration

        Args:
            subscription: Current subscription
            new_plan: Target plan
            immediate: Apply change immediately vs at period end

        Returns:
            (success, result_dict)
        """

        if not immediate:
            # Schedule change for end of period
            subscription.metadata['scheduled_plan_change'] = {
                'new_plan_id': new_plan.id,
                'scheduled_at': timezone.now().isoformat()
            }
            subscription.save()

            return True, {
                'status': 'scheduled',
                'effective_date': subscription.current_period_end.isoformat(),
                'new_plan': new_plan.name
            }

        # Calculate proration
        proration = ProrationService.calculate_proration(subscription, new_plan)

        # Handle payment for upgrade
        payment = None
        if proration['amount_due'] > 0:
            # User needs to pay difference (upgrade)
            payment = Payment.objects.create(
                user=subscription.user,
                subscription=subscription,
                amount=proration['amount_due'],
                currency=new_plan.currency,
                payment_method='stripe_card',  # Default, should come from user's saved method
                description=f"Prorated upgrade to {new_plan.name}",
                status='pending',
                metadata={'proration': proration['proration_details']}
            )

            # In production, this would charge the payment method
            # For now, mark as succeeded
            payment.mark_succeeded()

        elif proration['amount_due'] < 0:
            # Credit for downgrade - add to account balance or issue refund
            credit_amount = abs(proration['amount_due'])

            # Option 1: Store as account credit
            if not subscription.metadata.get('account_credits'):
                subscription.metadata['account_credits'] = []

            subscription.metadata['account_credits'].append({
                'amount': float(credit_amount),
                'reason': f'Downgrade from {subscription.plan.name} to {new_plan.name}',
                'created_at': timezone.now().isoformat()
            })

        # Update subscription
        old_plan_name = subscription.plan.name
        subscription.plan = new_plan

        # Reset period to new plan's interval
        subscription.current_period_start = timezone.now()
        if new_plan.interval == 'monthly':
            subscription.current_period_end = timezone.now() + timedelta(days=30)
        elif new_plan.interval == 'quarterly':
            subscription.current_period_end = timezone.now() + timedelta(days=90)
        elif new_plan.interval == 'yearly':
            subscription.current_period_end = timezone.now() + timedelta(days=365)

        subscription.save()

        return True, {
            'status': 'success',
            'old_plan': old_plan_name,
            'new_plan': new_plan.name,
            'proration': proration,
            'payment_id': payment.id if payment else None,
            'next_billing_date': subscription.current_period_end.isoformat()
        }


# ==================== Dunning Management ====================

class DunningService:
    """
    Handle failed payment recovery and subscription dunning
    """

    # Retry schedule (in days after failure)
    RETRY_SCHEDULE = [3, 7, 14, 21]  # Retry after 3, 7, 14, and 21 days

    @staticmethod
    def handle_failed_payment(payment: Payment) -> Dict:
        """
        Handle failed payment and initiate dunning process

        Returns dict with dunning actions taken
        """

        subscription = payment.subscription
        if not subscription:
            return {'error': 'No subscription associated with payment'}

        # Update subscription status
        subscription.status = 'past_due'
        subscription.save()

        # Get or create dunning record
        from .dunning_models import DunningAttempt

        attempt = DunningAttempt.objects.create(
            subscription=subscription,
            payment=payment,
            attempt_number=1,
            failure_reason=payment.failure_reason,
            status='pending'
        )

        # Schedule retry
        next_retry = timezone.now() + timedelta(days=DunningService.RETRY_SCHEDULE[0])
        attempt.next_retry_at = next_retry
        attempt.save()

        # Send notification to user
        DunningService._send_payment_failed_notification(subscription, payment)

        return {
            'dunning_attempt_id': attempt.id,
            'next_retry_at': next_retry.isoformat(),
            'subscription_status': subscription.status
        }

    @staticmethod
    def retry_failed_payment(subscription: UserSubscription) -> Tuple[bool, Dict]:
        """
        Retry charging a failed payment

        Returns:
            (success, result_dict)
        """

        from .dunning_models import DunningAttempt

        # Get latest dunning attempt
        try:
            attempt = DunningAttempt.objects.filter(
                subscription=subscription,
                status='pending'
            ).latest('created_at')
        except DunningAttempt.DoesNotExist:
            return False, {'error': 'No pending dunning attempt'}

        # Check if it's time to retry
        if attempt.next_retry_at and timezone.now() < attempt.next_retry_at:
            return False, {
                'error': 'Too early to retry',
                'next_retry_at': attempt.next_retry_at.isoformat()
            }

        # Attempt to charge payment
        # In production, this would integrate with payment gateway
        from .payment_services import PaymentService

        success, result = PaymentService.process_payment(
            payment_method='stripe_card',  # Should come from user's default method
            amount=subscription.plan.price,
            currency=subscription.plan.currency,
            subscription_id=subscription.id
        )

        attempt.attempt_number += 1
        attempt.attempted_at = timezone.now()

        if success:
            # Payment succeeded
            attempt.status = 'recovered'
            attempt.recovered_at = timezone.now()
            attempt.save()

            # Update subscription
            subscription.status = 'active'
            subscription.save()

            # Create payment record
            payment = Payment.objects.create(
                user=subscription.user,
                subscription=subscription,
                amount=subscription.plan.price,
                currency=subscription.plan.currency,
                payment_method='stripe_card',
                status='succeeded',
                description=f'Dunning recovery - {subscription.plan.name}',
                metadata={'dunning_attempt_id': attempt.id}
            )

            DunningService._send_payment_recovered_notification(subscription)

            return True, {
                'status': 'recovered',
                'payment_id': payment.id
            }

        else:
            # Payment failed again
            attempt.failure_reason = result.get('error', 'Unknown error')

            # Schedule next retry or cancel subscription
            if attempt.attempt_number < len(DunningService.RETRY_SCHEDULE):
                # Schedule next retry
                next_retry_days = DunningService.RETRY_SCHEDULE[attempt.attempt_number]
                attempt.next_retry_at = timezone.now() + timedelta(days=next_retry_days)
                attempt.save()

                DunningService._send_retry_notification(subscription, attempt)

                return False, {
                    'status': 'failed',
                    'attempt_number': attempt.attempt_number,
                    'next_retry_at': attempt.next_retry_at.isoformat()
                }

            else:
                # All retries exhausted - cancel subscription
                attempt.status = 'failed'
                attempt.save()

                subscription.status = 'canceled'
                subscription.canceled_at = timezone.now()
                subscription.current_period_end = timezone.now()
                subscription.save()

                DunningService._send_subscription_canceled_notification(subscription)

                return False, {
                    'status': 'canceled',
                    'reason': 'All payment retries exhausted'
                }

    @staticmethod
    def _send_payment_failed_notification(subscription: UserSubscription, payment: Payment):
        """Send notification about failed payment"""
        # In production, this would send email/SMS
        logger.info(f"Payment failed for subscription {subscription.id}")
        # TODO: Integrate with email service

    @staticmethod
    def _send_retry_notification(subscription: UserSubscription, attempt):
        """Send notification about upcoming retry"""
        logger.info(f"Payment retry scheduled for subscription {subscription.id}")
        # TODO: Integrate with email service

    @staticmethod
    def _send_payment_recovered_notification(subscription: UserSubscription):
        """Send notification about successful payment recovery"""
        logger.info(f"Payment recovered for subscription {subscription.id}")
        # TODO: Integrate with email service

    @staticmethod
    def _send_subscription_canceled_notification(subscription: UserSubscription):
        """Send notification about subscription cancellation"""
        logger.info(f"Subscription {subscription.id} canceled due to failed payments")
        # TODO: Integrate with email service


# ==================== Auto-Renewal Service ====================

class AutoRenewalService:
    """
    Handle automatic subscription renewals
    """

    @staticmethod
    def process_renewal(subscription: UserSubscription) -> Tuple[bool, Dict]:
        """
        Process subscription renewal

        Returns:
            (success, result_dict)
        """

        if not subscription.auto_renew:
            return False, {'error': 'Auto-renewal disabled'}

        if subscription.cancel_at_period_end:
            # Don't renew if scheduled for cancellation
            subscription.status = 'canceled'
            subscription.canceled_at = timezone.now()
            subscription.save()

            return False, {
                'status': 'canceled',
                'reason': 'Scheduled for cancellation'
            }

        # Check for scheduled plan change
        scheduled_change = subscription.metadata.get('scheduled_plan_change')
        if scheduled_change:
            # Apply scheduled plan change
            new_plan = SubscriptionPlan.objects.get(id=scheduled_change['new_plan_id'])
            subscription.plan = new_plan
            del subscription.metadata['scheduled_plan_change']

        # Attempt to charge renewal
        from .payment_services import PaymentService

        success, result = PaymentService.process_payment(
            payment_method='stripe_card',  # Should come from user's default method
            amount=subscription.plan.price,
            currency=subscription.plan.currency,
            subscription_id=subscription.id,
            description=f'Renewal - {subscription.plan.name}'
        )

        if success:
            # Renewal succeeded
            payment = Payment.objects.create(
                user=subscription.user,
                subscription=subscription,
                amount=subscription.plan.price,
                currency=subscription.plan.currency,
                payment_method='stripe_card',
                status='succeeded',
                description=f'Renewal - {subscription.plan.name}'
            )

            # Extend subscription period
            subscription.renew()

            return True, {
                'status': 'renewed',
                'payment_id': payment.id,
                'next_billing_date': subscription.current_period_end.isoformat()
            }

        else:
            # Renewal failed - initiate dunning
            payment = Payment.objects.create(
                user=subscription.user,
                subscription=subscription,
                amount=subscription.plan.price,
                currency=subscription.plan.currency,
                payment_method='stripe_card',
                status='failed',
                failure_reason=result.get('error', 'Unknown error'),
                description=f'Failed renewal - {subscription.plan.name}'
            )

            dunning_result = DunningService.handle_failed_payment(payment)

            return False, {
                'status': 'failed',
                'error': result.get('error'),
                'dunning': dunning_result
            }

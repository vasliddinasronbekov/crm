"""
Automated email campaign tasks.
"""
from celery import shared_task
from django.core.mail import send_mail, send_mass_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)


@shared_task(name='send_email_campaign')
def send_email_campaign(campaign_id):
    """
    Send automated email campaign to subscribers.

    Args:
        campaign_id: ID of the EmailCampaign to send
    """
    try:
        from .email_models import EmailCampaign, EmailLog

        campaign = EmailCampaign.objects.get(id=campaign_id)

        if campaign.status != 'scheduled':
            logger.warning(f"Campaign {campaign_id} is not in scheduled status")
            return {'success': False, 'reason': 'Invalid status'}

        # Mark as sending
        campaign.status = 'sending'
        campaign.save()

        recipients = campaign.get_recipients()
        sent_count = 0
        failed_count = 0

        for recipient in recipients:
            try:
                # Render email template
                context = {
                    'recipient': recipient,
                    'campaign': campaign,
                    'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe/{recipient.id}"
                }

                html_message = render_to_string(campaign.template.html_template, context)
                text_message = render_to_string(campaign.template.text_template, context)

                # Send email
                send_mail(
                    subject=campaign.subject,
                    message=text_message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient.email],
                    html_message=html_message,
                    fail_silently=False
                )

                # Log success
                EmailLog.objects.create(
                    campaign=campaign,
                    recipient_email=recipient.email,
                    status='sent',
                    sent_at=timezone.now()
                )
                sent_count += 1

            except Exception as e:
                logger.error(f"Failed to send email to {recipient.email}: {e}")
                EmailLog.objects.create(
                    campaign=campaign,
                    recipient_email=recipient.email,
                    status='failed',
                    error_message=str(e)
                )
                failed_count += 1

        # Update campaign status
        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.recipients_count = len(recipients)
        campaign.sent_count = sent_count
        campaign.failed_count = failed_count
        campaign.save()

        logger.info(f"Campaign {campaign_id} completed: {sent_count} sent, {failed_count} failed")

        return {
            'success': True,
            'campaign_id': campaign_id,
            'sent_count': sent_count,
            'failed_count': failed_count
        }

    except Exception as e:
        logger.exception(f"Email campaign {campaign_id} failed")
        return {'success': False, 'error': str(e)}


@shared_task(name='send_automated_emails')
def send_automated_emails():
    """
    Process and send automated emails (welcome, reminder, etc.).
    Runs every 15 minutes.
    """
    try:
        from .email_models import AutomatedEmail

        # Get pending automated emails
        pending_emails = AutomatedEmail.objects.filter(
            status='pending',
            scheduled_for__lte=timezone.now()
        )

        sent_count = 0
        failed_count = 0

        for automated_email in pending_emails[:100]:  # Process max 100 at a time
            try:
                automated_email.send()
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send automated email {automated_email.id}: {e}")
                automated_email.status = 'failed'
                automated_email.error_message = str(e)
                automated_email.save()
                failed_count += 1

        return {
            'success': True,
            'sent_count': sent_count,
            'failed_count': failed_count
        }

    except Exception as e:
        logger.exception("Failed to process automated emails")
        return {'success': False, 'error': str(e)}


@shared_task(name='process_email_queue')
def process_email_queue():
    """
    Process email queue with rate limiting.
    Prevents sending too many emails at once.
    """
    try:
        from .email_models import EmailQueue

        # Get emails to send (max 50 per minute to avoid rate limits)
        emails_to_send = EmailQueue.objects.filter(
            status='queued',
            scheduled_for__lte=timezone.now()
        ).order_by('priority', 'created_at')[:50]

        sent_count = 0

        for email in emails_to_send:
            try:
                send_mail(
                    subject=email.subject,
                    message=email.body_text,
                    from_email=email.from_email or settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email.to_email],
                    html_message=email.body_html,
                    fail_silently=False
                )

                email.status = 'sent'
                email.sent_at = timezone.now()
                email.save()
                sent_count += 1

            except Exception as e:
                logger.error(f"Failed to send queued email {email.id}: {e}")
                email.status = 'failed'
                email.error_message = str(e)
                email.attempts += 1

                # Retry logic: schedule for retry if attempts < 3
                if email.attempts < 3:
                    email.status = 'queued'
                    email.scheduled_for = timezone.now() + timedelta(minutes=5 * email.attempts)

                email.save()

        return {
            'success': True,
            'sent_count': sent_count
        }

    except Exception as e:
        logger.exception("Failed to process email queue")
        return {'success': False, 'error': str(e)}


@shared_task(name='cleanup_old_email_logs')
def cleanup_old_email_logs(days_to_keep=90):
    """
    Clean up old email logs to save database space.

    Args:
        days_to_keep: Number of days to keep logs (default: 90)
    """
    try:
        from .email_models import EmailLog

        cutoff_date = timezone.now() - timedelta(days=days_to_keep)

        deleted_count, _ = EmailLog.objects.filter(
            created_at__lt=cutoff_date
        ).delete()

        logger.info(f"Deleted {deleted_count} old email logs")

        return {
            'success': True,
            'deleted_count': deleted_count
        }

    except Exception as e:
        logger.exception("Failed to cleanup email logs")
        return {'success': False, 'error': str(e)}

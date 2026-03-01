"""
Celery Tasks for Reports and Reminders
Background tasks for automated report generation and payment reminders
"""
from celery import shared_task
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from datetime import timedelta, datetime
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def generate_scheduled_report(self, generation_id):
    """
    Generate a scheduled report
    Args:
        generation_id: ID of the ReportGeneration instance
    """
    from .report_models import ReportGeneration, ScheduledReport
    from .models import (
        Attendance, Payment, Group, ExamScore
    )
    from .accounting_models import FinancialSummary, StudentBalance, TeacherEarnings

    try:
        generation = ReportGeneration.objects.select_related('scheduled_report').get(id=generation_id)
        generation.status = 'processing'
        generation.save(update_fields=['status'])

        report_type = generation.report_type
        parameters = generation.parameters

        # Generate report based on type
        if report_type == 'attendance':
            report_data = _generate_attendance_report(parameters)
        elif report_type == 'performance':
            report_data = _generate_performance_report(parameters)
        elif report_type == 'revenue':
            report_data = _generate_revenue_report(parameters)
        elif report_type == 'profit_loss':
            report_data = _generate_profit_loss_report(parameters)
        elif report_type == 'cash_flow':
            report_data = _generate_cash_flow_report(parameters)
        elif report_type == 'accounts_receivable':
            report_data = _generate_accounts_receivable_report(parameters)
        elif report_type == 'teacher_compensation':
            report_data = _generate_teacher_compensation_report(parameters)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

        # Save report data
        generation.result_data = report_data
        generation.status = 'completed'
        generation.completed_at = timezone.now()
        generation.save(update_fields=['result_data', 'status', 'completed_at'])

        # Send report to recipients
        if generation.scheduled_report:
            send_report_email.delay(generation.id)

            # Update scheduled report last_run and calculate next_run
            scheduled_report = generation.scheduled_report
            scheduled_report.last_run = timezone.now()
            scheduled_report.calculate_next_run()
            scheduled_report.save(update_fields=['last_run', 'next_run'])

        logger.info(f"Successfully generated report {generation_id}")

    except Exception as e:
        logger.error(f"Failed to generate report {generation_id}: {str(e)}")

        try:
            generation = ReportGeneration.objects.get(id=generation_id)
            generation.status = 'failed'
            generation.error_message = str(e)
            generation.completed_at = timezone.now()
            generation.save(update_fields=['status', 'error_message', 'completed_at'])
        except:
            pass

        # Retry
        raise self.retry(exc=e, countdown=60)


@shared_task
def send_report_email(generation_id):
    """
    Send generated report via email
    Args:
        generation_id: ID of the ReportGeneration instance
    """
    from .report_models import ReportGeneration
    import json

    try:
        generation = ReportGeneration.objects.select_related('scheduled_report').get(id=generation_id)

        if not generation.scheduled_report:
            logger.warning(f"No scheduled report for generation {generation_id}")
            return

        recipients = generation.scheduled_report.get_recipients_list()
        if not recipients:
            logger.warning(f"No recipients for report generation {generation_id}")
            return

        # Prepare email context
        context = {
            'report_type': generation.scheduled_report.get_report_type_display(),
            'generated_at': generation.completed_at,
            'report_data': generation.result_data,
        }

        # Render email template
        html_content = render_to_string('emails/scheduled_report.html', context)
        text_content = f"Report: {context['report_type']}\nGenerated: {context['generated_at']}"

        # Create email
        subject = f"Scheduled Report: {context['report_type']}"
        from_email = settings.DEFAULT_FROM_EMAIL

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=recipients
        )
        email.attach_alternative(html_content, "text/html")

        # Attach CSV or PDF if available
        if generation.file_path:
            with open(generation.file_path, 'rb') as f:
                email.attach(f"report_{generation.id}.csv", f.read(), 'text/csv')

        # Send email
        email.send(fail_silently=False)

        logger.info(f"Sent report {generation_id} to {len(recipients)} recipients")

    except Exception as e:
        logger.error(f"Failed to send report email {generation_id}: {str(e)}")


@shared_task
def check_and_send_payment_reminders():
    """
    Check for payments that need reminders and send them
    This task should be run daily via Celery Beat
    """
    from .report_models import PaymentReminderSettings, PaymentReminder
    from .models import Payment

    try:
        # Get reminder settings
        settings_obj = PaymentReminderSettings.objects.first()

        if not settings_obj or not settings_obj.enabled:
            logger.info("Payment reminders are disabled")
            return

        # Calculate target date based on days_before_due
        target_date = timezone.now().date() + timedelta(days=settings_obj.days_before_due)

        # Find pending payments due around target date
        pending_payments = Payment.objects.filter(
            status='pending',
            due_date=target_date
        ).select_related('by_user')

        reminders_sent = 0

        for payment in pending_payments:
            # Check if reminder already sent recently
            recent_reminder = PaymentReminder.objects.filter(
                payment=payment,
                scheduled_at__gte=timezone.now() - timedelta(days=settings_obj.days_before_due),
                status__in=['sent', 'pending']
            ).exists()

            if recent_reminder:
                continue

            # Check frequency
            if settings_obj.frequency == 'weekly':
                # Only send on specific day of week
                if timezone.now().weekday() != 0:  # Monday
                    continue
            elif settings_obj.frequency == 'biweekly':
                # Only send every 2 weeks
                last_reminder = PaymentReminder.objects.filter(
                    payment=payment,
                    status='sent'
                ).order_by('-sent_at').first()

                if last_reminder and (timezone.now() - last_reminder.sent_at).days < 14:
                    continue

            # Create reminder
            if payment.by_user and payment.by_user.email:
                reminder = PaymentReminder.objects.create(
                    payment=payment,
                    recipient_email=payment.by_user.email,
                    template_used=settings_obj.email_template,
                    status='pending',
                    metadata={
                        'auto_generated': True,
                        'days_before_due': settings_obj.days_before_due
                    }
                )

                # Send reminder email
                send_payment_reminder_email.delay(reminder.id)
                reminders_sent += 1

        logger.info(f"Queued {reminders_sent} payment reminders")

    except Exception as e:
        logger.error(f"Failed to check payment reminders: {str(e)}")


@shared_task(bind=True, max_retries=3)
def send_payment_reminder_email(self, reminder_id):
    """
    Send a payment reminder email
    Args:
        reminder_id: ID of the PaymentReminder instance
    """
    from .report_models import PaymentReminder

    try:
        reminder = PaymentReminder.objects.select_related('payment', 'payment__by_user', 'payment__group').get(id=reminder_id)

        payment = reminder.payment
        student = payment.by_user

        # Select email template based on template_used
        template_name = f'emails/payment_reminder_{reminder.template_used}.html'

        # Prepare context
        context = {
            'student_name': f"{student.first_name} {student.last_name}".strip() or student.username,
            'payment_amount': payment.amount / 100,
            'payment_date': payment.date,
            'payment_due_date': payment.due_date if hasattr(payment, 'due_date') else None,
            'group_name': payment.group.name if payment.group else 'N/A',
            'payment_id': payment.id,
            'custom_message': reminder.metadata.get('custom_message', ''),
        }

        # Render email
        html_content = render_to_string(template_name, context)
        text_content = f"Payment Reminder\n\nDear {context['student_name']},\n\nYou have a pending payment of {context['payment_amount']} UZS."

        # Create email
        subject = _get_reminder_subject(reminder.template_used)
        from_email = settings.DEFAULT_FROM_EMAIL

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[reminder.recipient_email]
        )
        email.attach_alternative(html_content, "text/html")

        # Send email
        email.send(fail_silently=False)

        # Update reminder status
        reminder.status = 'sent'
        reminder.sent_at = timezone.now()
        reminder.save(update_fields=['status', 'sent_at'])

        logger.info(f"Sent payment reminder {reminder_id} to {reminder.recipient_email}")

    except Exception as e:
        logger.error(f"Failed to send payment reminder {reminder_id}: {str(e)}")

        try:
            reminder = PaymentReminder.objects.get(id=reminder_id)
            reminder.status = 'failed'
            reminder.error_message = str(e)
            reminder.save(update_fields=['status', 'error_message'])
        except:
            pass

        # Retry
        raise self.retry(exc=e, countdown=60)


@shared_task
def send_payment_reminders(reminder_ids):
    """
    Send multiple payment reminders (bulk operation)
    Args:
        reminder_ids: List of PaymentReminder IDs
    """
    for reminder_id in reminder_ids:
        send_payment_reminder_email.delay(reminder_id)


@shared_task
def cleanup_old_report_generations():
    """
    Clean up old report generation records
    Keeps last 90 days, deletes older ones
    """
    from .report_models import ReportGeneration

    try:
        cutoff_date = timezone.now() - timedelta(days=90)

        deleted_count = ReportGeneration.objects.filter(
            started_at__lt=cutoff_date,
            status__in=['completed', 'failed']
        ).delete()[0]

        logger.info(f"Cleaned up {deleted_count} old report generations")

    except Exception as e:
        logger.error(f"Failed to cleanup report generations: {str(e)}")


# Helper functions for report generation

def _generate_attendance_report(parameters):
    """Generate attendance report data"""
    from .models import Attendance
    from django.db.models import Count, Q

    attendances = Attendance.objects.select_related('student', 'group').all()

    # Apply date filters
    if 'date_from' in parameters:
        attendances = attendances.filter(date__gte=parameters['date_from'])
    if 'date_to' in parameters:
        attendances = attendances.filter(date__lte=parameters['date_to'])

    # Calculate statistics
    total_records = attendances.count()
    present_count = attendances.filter(is_present=True).count()
    absent_count = total_records - present_count
    attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0

    return {
        'total_records': total_records,
        'present_count': present_count,
        'absent_count': absent_count,
        'attendance_rate': round(attendance_rate, 2),
        'records': list(attendances.values('student__username', 'group__name', 'date', 'is_present')[:100])
    }


def _generate_profit_loss_report(parameters):
    """Generate profit & loss report data"""
    from .models import Payment
    from .accounting_models import FinancialSummary
    from django.db.models import Sum

    # Get revenue from payments
    payments = Payment.objects.filter(status='paid')
    if 'date_from' in parameters:
        payments = payments.filter(date__gte=parameters['date_from'])
    if 'date_to' in parameters:
        payments = payments.filter(date__lte=parameters['date_to'])

    total_revenue = payments.aggregate(total=Sum('amount'))['total'] or 0

    # Get expenses from financial summaries
    financial_summaries = FinancialSummary.objects.all()
    if 'date_from' in parameters:
        financial_summaries = financial_summaries.filter(period_start__gte=parameters['date_from'])
    if 'date_to' in parameters:
        financial_summaries = financial_summaries.filter(period_end__lte=parameters['date_to'])

    total_expenses = financial_summaries.aggregate(total=Sum('total_expenses'))['total'] or 0

    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0

    return {
        'total_revenue': total_revenue / 100,
        'total_expenses': total_expenses / 100,
        'net_profit': net_profit / 100,
        'profit_margin': round(profit_margin, 2)
    }


def _generate_accounts_receivable_report(parameters):
    """Generate accounts receivable report data"""
    from .accounting_models import StudentBalance
    from django.db.models import Sum

    balances = StudentBalance.objects.filter(balance_amount__gt=0).select_related('student')

    total_outstanding = balances.aggregate(total=Sum('balance_amount'))['total'] or 0

    # Aging analysis (simplified - would need due_date field in production)
    aging_data = {
        '0-30': balances.count() * 0.3,  # Simplified
        '31-60': balances.count() * 0.3,
        '61-90': balances.count() * 0.2,
        '90+': balances.count() * 0.2,
    }

    return {
        'total_outstanding': total_outstanding / 100,
        'total_students': balances.count(),
        'aging': aging_data,
        'students': list(balances.values('student__username', 'balance_amount')[:50])
    }


def _generate_teacher_compensation_report(parameters):
    """Generate teacher compensation report data"""
    from .accounting_models import TeacherEarnings
    from django.db.models import Sum

    earnings = TeacherEarnings.objects.select_related('teacher').all()

    if 'date_from' in parameters:
        earnings = earnings.filter(period_start__gte=parameters['date_from'])
    if 'date_to' in parameters:
        earnings = earnings.filter(period_end__lte=parameters['date_to'])

    total_earnings = earnings.aggregate(total=Sum('total_earned'))['total'] or 0
    total_paid = earnings.aggregate(total=Sum('paid_amount'))['total'] or 0
    total_pending = total_earnings - total_paid

    return {
        'total_earnings': total_earnings / 100,
        'total_paid': total_paid / 100,
        'total_pending': total_pending / 100,
        'teachers': list(earnings.values('teacher__username', 'total_earned', 'paid_amount')[:50])
    }


def _generate_performance_report(parameters):
    """Generate performance analytics report"""
    from .models import ExamScore
    from django.db.models import Avg

    scores = ExamScore.objects.select_related('student', 'group').all()

    if 'date_from' in parameters:
        scores = scores.filter(date__gte=parameters['date_from'])
    if 'date_to' in parameters:
        scores = scores.filter(date__lte=parameters['date_to'])

    avg_score = scores.aggregate(avg=Avg('score'))['avg'] or 0

    return {
        'total_exams': scores.count(),
        'average_score': round(avg_score, 2),
        'records': list(scores.values('student__username', 'group__name', 'score', 'date')[:100])
    }


def _generate_revenue_report(parameters):
    """Generate revenue by course report"""
    from .models import Payment, Group
    from django.db.models import Sum

    payments = Payment.objects.filter(status='paid').select_related('group', 'group__course')

    if 'date_from' in parameters:
        payments = payments.filter(date__gte=parameters['date_from'])
    if 'date_to' in parameters:
        payments = payments.filter(date__lte=parameters['date_to'])

    # Group by course
    by_course = payments.values('group__course__name').annotate(
        total=Sum('amount')
    ).order_by('-total')

    total_revenue = payments.aggregate(total=Sum('amount'))['total'] or 0

    return {
        'total_revenue': total_revenue / 100,
        'by_course': [
            {
                'course': item['group__course__name'] or 'Unknown',
                'revenue': item['total'] / 100
            }
            for item in by_course
        ]
    }


def _generate_cash_flow_report(parameters):
    """Generate cash flow report"""
    from .accounting_models import Transaction
    from django.db.models import Sum, Q

    transactions = Transaction.objects.all()

    if 'date_from' in parameters:
        transactions = transactions.filter(transaction_date__gte=parameters['date_from'])
    if 'date_to' in parameters:
        transactions = transactions.filter(transaction_date__lte=parameters['date_to'])

    # Operating activities (simplified)
    cash_in = transactions.filter(transaction_type='income').aggregate(total=Sum('amount'))['total'] or 0
    cash_out = transactions.filter(transaction_type='expense').aggregate(total=Sum('amount'))['total'] or 0

    net_cash_flow = cash_in - cash_out

    return {
        'cash_in': cash_in / 100,
        'cash_out': cash_out / 100,
        'net_cash_flow': net_cash_flow / 100,
    }


def _get_reminder_subject(template_type):
    """Get email subject based on template type"""
    subjects = {
        'default': 'Payment Reminder',
        'friendly': 'Friendly Reminder: Upcoming Payment',
        'urgent': 'Urgent: Payment Due Soon',
        'final': 'Final Notice: Payment Overdue'
    }
    return subjects.get(template_type, 'Payment Reminder')

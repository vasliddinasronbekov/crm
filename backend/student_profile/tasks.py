"""
Celery tasks for automated accounting operations.
These tasks run automatically to calculate financial summaries, send reminders, and generate reports.
"""

import logging
from celery import shared_task
from django.utils import timezone
from django.db.models import Sum, Q
from django.db import transaction
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

from .accounting_models import (
    FinancialSummary,
    StudentBalance,
    TeacherEarnings,
    StudentFine,
    AccountTransaction,
    MonthlyFeeLog
)
from .models import Branch, Payment
from .models import Group
from users.models import User
from .services.financial_automation import apply_monthly_subscription_charge


@shared_task(name='calculate_daily_financial_summary')
def calculate_daily_financial_summary(date: Optional[str] = None, branch_id: Optional[int] = None):
    """
    Calculate financial summary for a specific date.
    If no date provided, calculates for yesterday (since today is not complete yet).

    Args:
        date: Date string in YYYY-MM-DD format (optional)
        branch_id: Branch ID to calculate for (optional, None = all branches)

    Returns:
        dict: Summary of calculations performed
    """
    if date:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
    else:
        # Default to yesterday since today is not complete
        target_date = timezone.now().date() - timedelta(days=1)

    branch = None
    if branch_id:
        try:
            branch = Branch.objects.get(id=branch_id)
        except Branch.DoesNotExist:
            return {
                'success': False,
                'error': f'Branch {branch_id} not found'
            }

    try:
        # Get or create summary
        summary, created = FinancialSummary.objects.get_or_create(
            date=target_date,
            branch=branch
        )

        # Calculate metrics
        summary.calculate()

        return {
            'success': True,
            'date': str(target_date),
            'branch_id': branch_id,
            'created': created,
            'total_payments': summary.total_payments / 100,
            'total_expenses': summary.total_expenses / 100,
            'net_profit': summary.net_profit / 100,
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'date': str(target_date)
        }


@shared_task(name='calculate_weekly_financial_summaries')
def calculate_weekly_financial_summaries(branch_id: Optional[int] = None):
    """
    Calculate financial summaries for the past week.
    Useful for catching up on missed daily calculations.

    Args:
        branch_id: Branch ID to calculate for (optional)

    Returns:
        dict: Results for each day
    """
    today = timezone.now().date()
    results = []

    for days_ago in range(7):
        target_date = today - timedelta(days=days_ago)
        result = calculate_daily_financial_summary(
            date=str(target_date),
            branch_id=branch_id
        )
        results.append(result)

    return {
        'success': True,
        'days_calculated': len(results),
        'results': results
    }


@shared_task(name='calculate_monthly_financial_summaries')
def calculate_monthly_financial_summaries(year: int, month: int, branch_id: Optional[int] = None):
    """
    Calculate financial summaries for an entire month.

    Args:
        year: Year (e.g., 2025)
        month: Month (1-12)
        branch_id: Branch ID to calculate for (optional)

    Returns:
        dict: Results for each day in the month
    """
    # Get first and last day of month
    first_day = datetime(year, month, 1).date()
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)

    results = []
    current = first_day

    while current <= last_day:
        result = calculate_daily_financial_summary(
            date=str(current),
            branch_id=branch_id
        )
        results.append(result)
        current += timedelta(days=1)

    success_count = sum(1 for r in results if r.get('success'))

    return {
        'success': True,
        'year': year,
        'month': month,
        'total_days': len(results),
        'successful': success_count,
        'failed': len(results) - success_count,
        'results': results
    }


@shared_task(name='send_payment_reminders')
def send_payment_reminders(days_threshold: int = 7):
    """
    Send payment reminders to students with outstanding balances.

    Args:
        days_threshold: Only send reminders if last payment was more than this many days ago

    Returns:
        dict: Summary of reminders sent
    """
    threshold_date = timezone.now().date() - timedelta(days=days_threshold)

    # Get students with debt who haven't paid recently
    balances_with_debt = StudentBalance.objects.filter(
        is_fully_paid=False,
        balance__gt=0
    ).filter(
        Q(last_payment_date__lt=threshold_date) | Q(last_payment_date__isnull=True)
    ).select_related('student', 'group', 'group__course')

    reminders_sent = 0
    reminders_failed = 0
    results = []

    for balance in balances_with_debt:
        try:
            # TODO: Integrate with SMS/Email service
            # For now, just log the reminder
            reminder_data = {
                'student_id': balance.student.id,
                'student_name': balance.student.get_full_name(),
                'student_phone': balance.student.phone,
                'group_name': balance.group.name,
                'balance': balance.balance / 100,
                'last_payment': str(balance.last_payment_date) if balance.last_payment_date else 'Never',
            }

            # TODO: Send actual SMS/Email here
            # sms_service.send_reminder(reminder_data)

            results.append({
                'success': True,
                'student_id': balance.student.id,
                'balance': balance.balance / 100,
            })
            reminders_sent += 1

        except Exception as e:
            results.append({
                'success': False,
                'student_id': balance.student.id,
                'error': str(e)
            })
            reminders_failed += 1

    return {
        'success': True,
        'total_students_with_debt': balances_with_debt.count(),
        'reminders_sent': reminders_sent,
        'reminders_failed': reminders_failed,
        'results': results
    }


@shared_task(name='generate_teacher_earnings_report')
def generate_teacher_earnings_report(year: int, month: int, teacher_id: Optional[int] = None):
    """
    Generate monthly earnings report for teachers.

    Args:
        year: Year (e.g., 2025)
        month: Month (1-12)
        teacher_id: Specific teacher ID (optional, None = all teachers)

    Returns:
        dict: Earnings report data
    """
    # Get first and last day of month
    first_day = datetime(year, month, 1).date()
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)

    # Get earnings for the month
    earnings_query = TeacherEarnings.objects.filter(
        date__gte=first_day,
        date__lte=last_day
    )

    if teacher_id:
        earnings_query = earnings_query.filter(teacher_id=teacher_id)

    # Aggregate by teacher
    teacher_reports = []

    teachers = earnings_query.values('teacher_id').distinct()

    for teacher_data in teachers:
        teacher_id = teacher_data['teacher_id']
        teacher = User.objects.get(id=teacher_id)

        teacher_earnings = earnings_query.filter(teacher_id=teacher_id)

        total_earned = teacher_earnings.aggregate(total=Sum('amount'))['total'] or 0
        total_paid = teacher_earnings.filter(is_paid_to_teacher=True).aggregate(total=Sum('amount'))['total'] or 0
        total_unpaid = total_earned - total_paid

        teacher_reports.append({
            'teacher_id': teacher_id,
            'teacher_name': teacher.get_full_name(),
            'teacher_phone': teacher.phone,
            'earnings_count': teacher_earnings.count(),
            'total_earned': total_earned / 100,
            'total_paid': total_paid / 100,
            'total_unpaid': total_unpaid / 100,
            'payment_percentage': (total_paid / total_earned * 100) if total_earned > 0 else 0,
        })

    return {
        'success': True,
        'year': year,
        'month': month,
        'total_teachers': len(teacher_reports),
        'teachers': teacher_reports
    }


@shared_task(name='recalculate_all_student_balances')
def recalculate_all_student_balances():
    """
    Recalculate all student balances from scratch.
    Useful for fixing discrepancies.

    Returns:
        dict: Summary of recalculations
    """
    balances = StudentBalance.objects.all()

    success_count = 0
    error_count = 0
    errors = []

    for balance in balances:
        try:
            # Recalculate paid amount from actual payments
            paid_payments = Payment.objects.filter(
                by_user=balance.student,
                group=balance.group,
                status='paid'
            ).aggregate(total=Sum('amount'))

            balance.paid_amount = paid_payments['total'] or 0
            balance.calculate_balance()

            success_count += 1

        except Exception as e:
            error_count += 1
            errors.append({
                'student_id': balance.student.id,
                'group_id': balance.group.id,
                'error': str(e)
            })

    return {
        'success': True,
        'total_balances': balances.count(),
        'successful': success_count,
        'failed': error_count,
        'errors': errors
    }


@shared_task(name='auto_mark_paid_fines')
def auto_mark_paid_fines():
    """
    Automatically mark fines as paid when student has paid enough.

    Returns:
        dict: Summary of fines marked as paid
    """
    # Get all unpaid fines
    unpaid_fines = StudentFine.objects.filter(is_paid=False).select_related('student', 'group')

    marked_paid = 0

    for fine in unpaid_fines:
        try:
            # Check if student balance is fully paid or overpaid
            balance = StudentBalance.objects.get(
                student=fine.student,
                group=fine.group
            )

            if balance.balance <= 0:
                # Student has paid everything, mark fine as paid
                fine.mark_as_paid()
                marked_paid += 1

        except StudentBalance.DoesNotExist:
            # No balance found, skip this fine
            continue

    return {
        'success': True,
        'total_unpaid_fines': unpaid_fines.count(),
        'marked_as_paid': marked_paid
    }


@shared_task(name='cleanup_old_transactions')
def cleanup_old_transactions(days_to_keep: int = 365):
    """
    Archive or delete very old transaction records (optional optimization).

    Args:
        days_to_keep: Keep transactions from the last N days (default: 365)

    Returns:
        dict: Summary of cleanup
    """
    cutoff_date = timezone.now().date() - timedelta(days=days_to_keep)

    # Count old transactions
    old_transactions = AccountTransaction.objects.filter(
        transaction_date__lt=cutoff_date,
        status='completed'
    )

    count = old_transactions.count()

    # For now, just return count (don't actually delete)
    # In production, you might want to archive to a separate table or backup

    return {
        'success': True,
        'cutoff_date': str(cutoff_date),
        'old_transactions_count': count,
        'action': 'counted_only',  # Change to 'archived' or 'deleted' when implemented
    }


# Celery Beat Schedule Configuration
# Add this to your settings.py:
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Apply monthly fees on the 1st of every month at 4 AM
    'apply-monthly-fees': {
        'task': 'apply_monthly_fees',
        'schedule': crontab(day_of_month=1, hour=4, minute=0),
    },

    # Calculate yesterday's financial summary every day at 1 AM
    'calculate-daily-summary': {
        'task': 'calculate_daily_financial_summary',
        'schedule': crontab(hour=1, minute=0),
    },

    # Send payment reminders every Monday at 9 AM
    'send-payment-reminders': {
        'task': 'send_payment_reminders',
        'schedule': crontab(day_of_week=1, hour=9, minute=0),
        'kwargs': {'days_threshold': 7}
    },

    # Auto-mark paid fines every day at 2 AM
    'auto-mark-paid-fines': {
        'task': 'auto_mark_paid_fines',
        'schedule': crontab(hour=2, minute=0),
    },

    # Recalculate all balances every Sunday at 3 AM
    'recalculate-all-balances': {
        'task': 'recalculate_all_student_balances',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
    },
}
"""


@shared_task(name='apply_monthly_fees')
def apply_monthly_fees(target_date: Optional[str] = None):
    """
    Apply monthly course fees to all active student balances.
    This task should run on the first day of each month.
    If target_date is provided, it applies fees for that date.
    """
    if target_date:
        today = datetime.strptime(target_date, '%Y-%m-%d').date()
    else:
        today = timezone.now().date()
        
    # Find all active student balances in groups that are currently active
    active_balances = StudentBalance.objects.filter(
        group__start_day__lte=today,
        group__end_day__gte=today,
        student__is_active=True
    ).select_related('student', 'group', 'group__course')

    fees_applied = 0
    subscription_charges_applied = 0
    errors = []

    try:
        for balance in active_balances:
            try:
                # Idempotency check: See if a monthly fee has already been applied for this month
                if AccountTransaction.objects.filter(
                    student=balance.student,
                    group=balance.group,
                    transaction_type='monthly_fee',
                    transaction_date__year=today.year,
                    transaction_date__month=today.month
                ).exists():
                    continue # Skip if already applied

                with transaction.atomic():
                    course = balance.group.course
                    # The user specified that `course.price` is the monthly fee.
                    if course and course.price and course.price > 0:
                        monthly_fee = course.price
                    else:
                        # If course price is not set or is zero, skip this balance.
                        continue

                    # Add the charge to the student's balance by increasing their owed fee
                    balance.add_charge(monthly_fee)

                    # Create a transaction record for the audit trail
                    AccountTransaction.create_from_monthly_fee(
                        student=balance.student,
                        group=balance.group,
                        amount=monthly_fee,
                        fee_date=today
                    )
                    fees_applied += 1
            except Exception as e:
                logger.error(f"Error applying monthly fee for balance {balance.id}: {e}")
                errors.append({
                    'balance_id': balance.id,
                    'student_id': balance.student.id,
                    'error': str(e)
                })
    except Exception as e:
        logger.critical(f"FATAL: The 'apply_monthly_fees' task failed catastrophically. Error: {e}", exc_info=True)
        raise

    # Internal account billing (negative balances supported) for every active student-group enrollment.
    active_groups = Group.objects.filter(
        start_day__lte=today,
        end_day__gte=today,
    ).select_related('course').prefetch_related('students')

    for group in active_groups:
        if not group.course or group.course.price <= 0:
            continue
        for student in group.students.filter(is_active=True, is_teacher=False):
            try:
                _, created = apply_monthly_subscription_charge(
                    student=student,
                    group=group,
                    target_date=today,
                    actor=None,
                )
                if created:
                    subscription_charges_applied += 1
            except Exception as e:
                logger.error(
                    "Error applying internal monthly charge for student %s in group %s: %s",
                    student.id,
                    group.id,
                    e,
                )
                errors.append({
                    'student_id': student.id,
                    'group_id': group.id,
                    'error': str(e),
                    'type': 'internal_subscription_charge',
                })

    # Log that fees for this month have been applied
    if fees_applied > 0 and not target_date:
        logger.info(f"Successfully applied monthly fees for {today.month}/{today.year} to {fees_applied} students.")
        MonthlyFeeLog.objects.get_or_create(year=today.year, month=today.month)

    return {
        'success': True,
        'total_active_balances': active_balances.count(),
        'fees_applied_count': fees_applied,
        'internal_subscription_charges': subscription_charges_applied,
        'errors': errors
    }


@shared_task(name='check_and_apply_monthly_fees')
def check_and_apply_monthly_fees():
    """
    Daily task to check if monthly fees have been applied for the current month.
    If not, it runs the apply_monthly_fees task.
    """
    today = timezone.now().date()
    year = today.year
    month = today.month

    # Check if fees have already been applied for this month
    if MonthlyFeeLog.objects.filter(year=year, month=month).exists():
        logger.info(f"Fees already applied for {month}/{year}.")
        return {'status': 'Fees already applied for this month.'}

    # If it's past the 1st of the month and fees haven't been applied, run the task
    if today.day > 1:
        logger.critical(f"SELF-HEAL: Monthly fees for {month}/{year} were missed. Applying them automatically now.")
        apply_monthly_fees.delay()
        return {'status': f"Fees for {month}/{year} were missed and are now being applied."}

    logger.info(f"Not yet time to apply fees for {month}/{year}.")
    return {'status': 'Not yet time to apply fees for this month.'}

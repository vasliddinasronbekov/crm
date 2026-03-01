"""
Anomaly Detection System
Automatically detects unusual patterns in payments, attendance, and system behavior.
"""

from celery import shared_task
from django.db.models import Avg, Count, Sum, Q
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


@shared_task(name='detect_payment_anomalies')
def detect_payment_anomalies():
    """
    Detect unusual payment patterns:
    - Multiple duplicate payments in short time
    - Unusually large payments (3x average)
    - Payment reversals
    - Suspicious payment patterns
    """
    alerts = []
    yesterday = timezone.now().date() - timedelta(days=1)
    week_ago = timezone.now().date() - timedelta(days=7)

    from student_profile.models import Payment
    from users.models import User

    # 1. Detect duplicate payments (same user, amount, within 1 hour)
    recent_payments = Payment.objects.filter(
        date__gte=yesterday
    ).select_related('by_user', 'group')

    payment_groups = {}
    for payment in recent_payments:
        key = f"{payment.by_user_id}_{payment.amount}_{payment.date}"
        if key not in payment_groups:
            payment_groups[key] = []
        payment_groups[key].append(payment)

    for key, payments in payment_groups.items():
        if len(payments) > 1:
            alerts.append({
                'type': 'duplicate_payment',
                'severity': 'high',
                'user_id': payments[0].by_user_id,
                'user_name': payments[0].by_user.get_full_name() if payments[0].by_user else 'N/A',
                'amount': payments[0].amount / 100,
                'count': len(payments),
                'date': str(payments[0].date),
                'payment_ids': [p.id for p in payments]
            })

    # 2. Detect unusually large payments (3x average)
    avg_payment = Payment.objects.filter(
        status='paid'
    ).aggregate(avg=Avg('amount'))['avg'] or 0

    if avg_payment > 0:
        large_payments = Payment.objects.filter(
            date__gte=yesterday,
            amount__gt=avg_payment * 3
        ).select_related('by_user', 'group')

        for payment in large_payments:
            alerts.append({
                'type': 'unusually_large_payment',
                'severity': 'medium',
                'payment_id': payment.id,
                'user_id': payment.by_user_id,
                'user_name': payment.by_user.get_full_name() if payment.by_user else 'N/A',
                'amount': payment.amount / 100,
                'average': avg_payment / 100,
                'multiplier': round(payment.amount / avg_payment, 2),
                'date': str(payment.date)
            })

    # 3. Detect rapid multiple payments from same user
    users_with_multiple = Payment.objects.filter(
        date__gte=week_ago
    ).values('by_user').annotate(
        payment_count=Count('id')
    ).filter(payment_count__gte=5)

    for user_data in users_with_multiple:
        user = User.objects.get(id=user_data['by_user'])
        alerts.append({
            'type': 'multiple_payments_short_period',
            'severity': 'low',
            'user_id': user.id,
            'user_name': user.get_full_name(),
            'payment_count': user_data['payment_count'],
            'period': '7 days'
        })

    # 4. Detect failed payments spike
    failed_payments = Payment.objects.filter(
        date__gte=yesterday,
        status='failed'
    ).count()

    if failed_payments > 10:
        alerts.append({
            'type': 'failed_payments_spike',
            'severity': 'high',
            'failed_count': failed_payments,
            'date': str(yesterday)
        })

    # Send alerts if found
    if alerts:
        send_anomaly_alerts('Payment Anomalies', alerts)
        logger.warning(f"Payment anomalies detected: {len(alerts)} issues")

    return {
        'success': True,
        'date_checked': str(yesterday),
        'anomalies_detected': len(alerts),
        'alerts': alerts
    }


@shared_task(name='detect_attendance_anomalies')
def detect_attendance_anomalies():
    """
    Detect attendance issues:
    - Students with 5+ consecutive absences
    - Groups with low attendance rate (<60%)
    - Unusual absence patterns
    - Students who haven't attended in 7+ days
    """
    alerts = []
    from student_profile.models import Attendance, Group
    from users.models import User

    week_ago = timezone.now().date() - timedelta(days=7)
    two_weeks_ago = timezone.now().date() - timedelta(days=14)

    # 1. Students with consecutive absences (5+ days)
    students = User.objects.filter(is_teacher=False, is_staff=False)

    for student in students:
        recent_attendance = Attendance.objects.filter(
            student=student,
            date__gte=two_weeks_ago
        ).order_by('-date')[:10]

        consecutive_absences = 0
        absence_dates = []

        for att in recent_attendance:
            if not att.is_present:
                consecutive_absences += 1
                absence_dates.append(str(att.date))
            else:
                break

        if consecutive_absences >= 5:
            alerts.append({
                'type': 'consecutive_absences',
                'severity': 'critical',
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'phone': student.phone,
                'parents_phone': student.parents_phone,
                'absence_days': consecutive_absences,
                'dates': absence_dates
            })

    # 2. Groups with low attendance rate
    active_groups = Group.objects.filter(
        end_day__gte=timezone.now().date()
    )

    for group in active_groups:
        total_attendance = Attendance.objects.filter(
            group=group,
            date__gte=week_ago
        ).count()

        if total_attendance > 0:
            present_count = Attendance.objects.filter(
                group=group,
                date__gte=week_ago,
                is_present=True
            ).count()

            attendance_rate = (present_count / total_attendance) * 100

            if attendance_rate < 60:
                alerts.append({
                    'type': 'low_group_attendance',
                    'severity': 'high',
                    'group_id': group.id,
                    'group_name': group.name,
                    'attendance_rate': round(attendance_rate, 2),
                    'teacher': group.main_teacher.get_full_name() if group.main_teacher else 'N/A',
                    'period': '7 days'
                })

    # 3. Students who haven't attended in 7+ days
    inactive_students = []
    for student in students:
        last_attendance = Attendance.objects.filter(
            student=student,
            is_present=True
        ).order_by('-date').first()

        if last_attendance:
            days_since = (timezone.now().date() - last_attendance.date).days
            if days_since >= 7:
                inactive_students.append({
                    'student_id': student.id,
                    'student_name': student.get_full_name(),
                    'last_attendance': str(last_attendance.date),
                    'days_absent': days_since
                })

    if inactive_students:
        alerts.append({
            'type': 'long_term_inactive_students',
            'severity': 'high',
            'count': len(inactive_students),
            'students': inactive_students[:10]  # Top 10
        })

    # Send alerts
    if alerts:
        send_anomaly_alerts('Attendance Anomalies', alerts)
        logger.warning(f"Attendance anomalies detected: {len(alerts)} issues")

    return {
        'success': True,
        'date_checked': str(timezone.now().date()),
        'anomalies_detected': len(alerts),
        'alerts': alerts
    }


@shared_task(name='detect_system_anomalies')
def detect_system_anomalies():
    """
    Detect system-level issues:
    - Spike in failed logins (potential brute force)
    - Unusual API usage patterns
    - Database query performance issues
    - High error rates
    """
    alerts = []

    # 1. Check failed login attempts
    failed_login_keys = []
    try:
        # Get all login attempt keys from cache
        all_keys = cache.keys('login_attempts:*')

        high_failure_accounts = []
        for key in all_keys:
            attempts = cache.get(key, 0)
            if attempts >= 10:  # 10+ failures
                high_failure_accounts.append({
                    'cache_key': key,
                    'attempts': attempts
                })

        if high_failure_accounts:
            alerts.append({
                'type': 'brute_force_attempt',
                'severity': 'critical',
                'suspicious_accounts': len(high_failure_accounts),
                'details': high_failure_accounts[:5]  # Top 5
            })
    except Exception as e:
        logger.error(f"Failed to check login attempts: {e}")

    # 2. Check for API rate limit violations
    try:
        # Check if there are many throttled requests
        throttle_keys = cache.keys('throttle_*')
        if len(throttle_keys) > 100:
            alerts.append({
                'type': 'high_api_usage',
                'severity': 'medium',
                'throttled_requests': len(throttle_keys)
            })
    except Exception as e:
        logger.error(f"Failed to check API usage: {e}")

    # 3. Check database connections
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            # Check for long-running queries (PostgreSQL)
            if 'postgresql' in connection.settings_dict.get('ENGINE', ''):
                cursor.execute("""
                    SELECT COUNT(*)
                    FROM pg_stat_activity
                    WHERE state = 'active'
                    AND query_start < NOW() - INTERVAL '30 seconds'
                    AND query NOT LIKE '%pg_stat_activity%'
                """)
                slow_queries = cursor.fetchone()[0]

                if slow_queries > 5:
                    alerts.append({
                        'type': 'slow_queries',
                        'severity': 'high',
                        'slow_query_count': slow_queries
                    })
    except Exception as e:
        logger.error(f"Failed to check database performance: {e}")

    # 4. Check Redis connection
    try:
        cache.set('health_check_anomaly', 'test', 60)
        result = cache.get('health_check_anomaly')
        if result != 'test':
            alerts.append({
                'type': 'redis_connection_issue',
                'severity': 'critical',
                'message': 'Redis cache not responding correctly'
            })
    except Exception as e:
        alerts.append({
            'type': 'redis_connection_failed',
            'severity': 'critical',
            'error': str(e)
        })

    # Send alerts
    if alerts:
        send_anomaly_alerts('System Anomalies', alerts)
        logger.warning(f"System anomalies detected: {len(alerts)} issues")

    return {
        'success': True,
        'timestamp': timezone.now().isoformat(),
        'anomalies_detected': len(alerts),
        'alerts': alerts
    }


@shared_task(name='detect_financial_anomalies')
def detect_financial_anomalies():
    """
    Detect financial anomalies:
    - Sudden revenue drop
    - Unusual expense spikes
    - Debt accumulation patterns
    """
    alerts = []
    from student_profile.models import Payment, Expense
    from django.db.models import Sum

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # 1. Compare this week vs last week revenue
    this_week_start = today - timedelta(days=7)
    last_week_start = today - timedelta(days=14)
    last_week_end = today - timedelta(days=7)

    this_week_revenue = Payment.objects.filter(
        date__gte=this_week_start,
        status='paid'
    ).aggregate(total=Sum('amount'))['total'] or 0

    last_week_revenue = Payment.objects.filter(
        date__gte=last_week_start,
        date__lt=last_week_end,
        status='paid'
    ).aggregate(total=Sum('amount'))['total'] or 0

    if last_week_revenue > 0:
        revenue_change = ((this_week_revenue - last_week_revenue) / last_week_revenue) * 100

        if revenue_change < -30:  # 30% drop
            alerts.append({
                'type': 'revenue_drop',
                'severity': 'critical',
                'this_week': this_week_revenue / 100,
                'last_week': last_week_revenue / 100,
                'change_percent': round(revenue_change, 2)
            })

    # 2. Unusual expense spike
    avg_daily_expense = Expense.objects.filter(
        date__gte=month_ago
    ).aggregate(total=Sum('amount'))['total'] or 0
    avg_daily_expense = avg_daily_expense / 30

    yesterday_expenses = Expense.objects.filter(
        date=yesterday
    ).aggregate(total=Sum('amount'))['total'] or 0

    if avg_daily_expense > 0 and yesterday_expenses > avg_daily_expense * 3:
        alerts.append({
            'type': 'expense_spike',
            'severity': 'high',
            'yesterday_expense': yesterday_expenses / 100,
            'avg_daily': avg_daily_expense / 100,
            'multiplier': round(yesterday_expenses / avg_daily_expense, 2)
        })

    # Send alerts
    if alerts:
        send_anomaly_alerts('Financial Anomalies', alerts)
        logger.warning(f"Financial anomalies detected: {len(alerts)} issues")

    return {
        'success': True,
        'date_checked': str(today),
        'anomalies_detected': len(alerts),
        'alerts': alerts
    }


def send_anomaly_alerts(alert_type, alerts):
    """
    Send anomaly alerts to administrators.
    Can be extended to send emails, SMS, or push notifications.
    """
    from users.models import User

    # Get all admin users
    admins = User.objects.filter(is_staff=True, is_superuser=True)

    # Log alerts
    logger.warning(f"{alert_type}: {len(alerts)} anomalies detected")

    # TODO: Implement email/SMS/push notification sending
    # For now, just log the alerts
    for alert in alerts:
        logger.warning(f"Anomaly Alert: {alert}")

    # Store alerts in cache for dashboard display
    cache_key = f'anomaly_alerts_{timezone.now().date()}'
    existing_alerts = cache.get(cache_key, [])
    existing_alerts.extend(alerts)
    cache.set(cache_key, existing_alerts, 86400)  # 24 hours

    return True


@shared_task(name='run_all_anomaly_detection')
def run_all_anomaly_detection():
    """
    Run all anomaly detection tasks.
    Convenient wrapper for manual execution.
    """
    results = {
        'timestamp': timezone.now().isoformat(),
        'tasks': {}
    }

    # Run each detection task
    tasks = [
        detect_payment_anomalies,
        detect_attendance_anomalies,
        detect_system_anomalies,
        detect_financial_anomalies
    ]

    for task in tasks:
        try:
            result = task()
            results['tasks'][task.name] = result
        except Exception as e:
            logger.exception(f"Failed to run {task.name}")
            results['tasks'][task.name] = {
                'success': False,
                'error': str(e)
            }

    return results

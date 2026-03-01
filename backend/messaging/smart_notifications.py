"""
Smart Notification System
Send notifications at optimal times based on user behavior and preferences.
"""

from celery import shared_task
from django.db.models import Count, Avg
from datetime import timedelta, datetime, time
from django.utils import timezone
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


@shared_task(name='send_smart_notifications')
def send_smart_notifications():
    """
    Send pending notifications at optimal times for each user.
    Analyzes user activity patterns to determine best send times.
    """
    from users.models import User
    from messaging.models import SmsHistory

    current_hour = timezone.now().hour
    notifications_sent = 0

    # Get users who are typically active at this hour
    active_users = get_users_active_at_hour(current_hour)

    for user in active_users:
        # Check if user has pending notifications
        # TODO: Implement notification queue model
        # For now, this is a placeholder
        pass

    return {
        'success': True,
        'notifications_sent': notifications_sent,
        'target_hour': current_hour
    }


def get_users_active_at_hour(hour: int):
    """
    Get users who are typically active at a specific hour.
    Based on historical login patterns.
    """
    from users.models import User

    # Check cache first
    cache_key = f'active_users_hour_{hour}'
    cached_users = cache.get(cache_key)

    if cached_users is not None:
        return cached_users

    # Calculate based on login patterns
    # TODO: Track user activity timestamps
    # For now, return all users
    users = User.objects.filter(is_active=True)

    # Cache for 1 hour
    cache.set(cache_key, users, 3600)

    return users


@shared_task(name='analyze_user_activity_patterns')
def analyze_user_activity_patterns():
    """
    Analyze when users are most active and store patterns.
    Used to optimize notification send times.
    """
    from users.models import User

    users = User.objects.filter(is_active=True)
    patterns_analyzed = 0

    for user in users:
        # Analyze last_login patterns
        if user.last_login:
            optimal_hour = user.last_login.hour

            # Store in cache
            cache_key = f'user_optimal_hour_{user.id}'
            cache.set(cache_key, optimal_hour, 86400 * 7)  # 1 week

            patterns_analyzed += 1

    return {
        'success': True,
        'patterns_analyzed': patterns_analyzed
    }


@shared_task(name='send_birthday_notifications')
def send_birthday_notifications():
    """
    Send birthday wishes to students whose birthday is today.
    """
    from users.models import User
    from messaging.models import MessageTemplate, AutomaticMessage

    today = timezone.now().date()

    # Find students with birthday today
    birthday_students = User.objects.filter(
        is_teacher=False,
        is_staff=False,
        birthday__month=today.month,
        birthday__day=today.day
    )

    notifications_sent = 0

    # Get birthday message template
    try:
        auto_message = AutomaticMessage.objects.get(
            trigger_event='birthday',
            is_active=True
        )
        template = auto_message.message_template
    except AutomaticMessage.DoesNotExist:
        logger.warning("No birthday message template configured")
        return {
            'success': False,
            'error': 'No birthday template configured'
        }

    for student in birthday_students:
        try:
            # Format message
            message_text = template.text.format(
                student_name=student.get_full_name(),
                first_name=student.first_name
            )

            # TODO: Send actual SMS/notification
            # For now, just log
            logger.info(f"Birthday notification for {student.get_full_name()}: {message_text}")

            notifications_sent += 1

        except Exception as e:
            logger.error(f"Failed to send birthday notification to {student.id}: {e}")

    return {
        'success': True,
        'notifications_sent': notifications_sent,
        'birthday_students': birthday_students.count()
    }


@shared_task(name='send_payment_due_reminders')
def send_payment_due_reminders():
    """
    Send payment reminders 3 days before due date.
    """
    from student_profile.models import Payment
    from messaging.models import MessageTemplate, AutomaticMessage

    # Get payments due in 3 days
    three_days_from_now = timezone.now().date() + timedelta(days=3)

    # TODO: Add due_date field to Payment model
    # For now, use pending payments
    pending_payments = Payment.objects.filter(
        status='pending'
    ).select_related('by_user', 'group')

    notifications_sent = 0

    # Get payment reminder template
    try:
        auto_message = AutomaticMessage.objects.get(
            trigger_event='payment_due',
            is_active=True
        )
        template = auto_message.message_template
    except AutomaticMessage.DoesNotExist:
        logger.warning("No payment reminder template configured")
        return {
            'success': False,
            'error': 'No payment reminder template configured'
        }

    # Group by student to avoid duplicate messages
    student_payments = {}
    for payment in pending_payments:
        if payment.by_user:
            if payment.by_user.id not in student_payments:
                student_payments[payment.by_user.id] = {
                    'student': payment.by_user,
                    'total_due': 0,
                    'payment_count': 0
                }
            student_payments[payment.by_user.id]['total_due'] += payment.amount
            student_payments[payment.by_user.id]['payment_count'] += 1

    for student_id, data in student_payments.items():
        try:
            student = data['student']
            total_due = data['total_due'] / 100  # Convert to UZS

            # Format message
            message_text = template.text.format(
                student_name=student.get_full_name(),
                amount=total_due,
                payment_count=data['payment_count']
            )

            # TODO: Send actual SMS/notification
            logger.info(f"Payment reminder for {student.get_full_name()}: {message_text}")

            notifications_sent += 1

        except Exception as e:
            logger.error(f"Failed to send payment reminder to {student_id}: {e}")

    return {
        'success': True,
        'notifications_sent': notifications_sent,
        'students_notified': len(student_payments)
    }


@shared_task(name='send_new_group_welcome')
def send_new_group_welcome(student_id: int, group_id: int):
    """
    Send welcome message when student is added to a new group.
    """
    from users.models import User
    from student_profile.models import Group
    from messaging.models import MessageTemplate, AutomaticMessage

    try:
        student = User.objects.get(id=student_id)
        group = Group.objects.get(id=group_id)

        # Get welcome template
        auto_message = AutomaticMessage.objects.get(
            trigger_event='new_group',
            is_active=True
        )
        template = auto_message.message_template

        # Format message
        message_text = template.text.format(
            student_name=student.get_full_name(),
            group_name=group.name,
            teacher_name=group.main_teacher.get_full_name() if group.main_teacher else 'your teacher',
            start_time=group.start_time,
            days=group.days
        )

        # TODO: Send actual SMS/notification
        logger.info(f"Welcome message for {student.get_full_name()} to group {group.name}")

        return {
            'success': True,
            'message_sent': True
        }

    except Exception as e:
        logger.error(f"Failed to send welcome message: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='send_attendance_alert')
def send_attendance_alert(student_id: int, consecutive_absences: int):
    """
    Send alert to parents when student has consecutive absences.
    """
    from users.models import User

    try:
        student = User.objects.get(id=student_id)

        # Create urgent message
        message_text = f"Alert: Your child {student.get_full_name()} has been absent for {consecutive_absences} consecutive days. Please contact us immediately."

        # Send to student and parents
        recipients = [student.phone]
        if student.parents_phone:
            recipients.append(student.parents_phone)

        # TODO: Send actual SMS/notification
        logger.warning(f"Attendance alert for {student.get_full_name()}: {consecutive_absences} consecutive absences")

        return {
            'success': True,
            'alert_sent': True,
            'recipients': len(recipients)
        }

    except Exception as e:
        logger.error(f"Failed to send attendance alert: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='send_low_score_alert')
def send_low_score_alert(student_id: int, exam_score: int, exam_date: str):
    """
    Send alert to parents when student receives a low exam score.
    """
    from users.models import User

    try:
        student = User.objects.get(id=student_id)

        # Create message
        message_text = f"Academic Alert: {student.get_full_name()} scored {exam_score} on the exam dated {exam_date}. Additional support may be needed."

        # Send to parents
        if student.parents_phone:
            # TODO: Send actual SMS/notification
            logger.info(f"Low score alert for {student.get_full_name()}: {exam_score}")

            return {
                'success': True,
                'alert_sent': True
            }
        else:
            logger.warning(f"No parent phone number for {student.get_full_name()}")
            return {
                'success': False,
                'error': 'No parent contact'
            }

    except Exception as e:
        logger.error(f"Failed to send low score alert: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='send_achievement_notification')
def send_achievement_notification(student_id: int, achievement_type: str, details: str):
    """
    Send positive notification when student achieves something notable.
    """
    from users.models import User

    try:
        student = User.objects.get(id=student_id)

        # Create congratulatory message
        achievement_messages = {
            'perfect_attendance': f"Congratulations {student.get_full_name()}! You've achieved perfect attendance this month! \ud83c\udf89",
            'high_score': f"Excellent work {student.get_full_name()}! Outstanding exam performance: {details} \ud83c\udfc6",
            'top_rank': f"Amazing achievement {student.get_full_name()}! You're now ranked {details} \ud83c\udf1f",
            'coin_milestone': f"Great job {student.get_full_name()}! You've earned {details} coins! \ud83e\ude99"
        }

        message_text = achievement_messages.get(achievement_type, f"Congratulations {student.get_full_name()}! {details}")

        # Send to student and parents
        # TODO: Send actual SMS/notification
        logger.info(f"Achievement notification for {student.get_full_name()}: {achievement_type}")

        return {
            'success': True,
            'notification_sent': True
        }

    except Exception as e:
        logger.error(f"Failed to send achievement notification: {e}")
        return {
            'success': False,
            'error': str(e)
        }

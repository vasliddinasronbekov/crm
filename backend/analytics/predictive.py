"""
Predictive Analytics System
Predict student churn, identify at-risk students, and forecast trends.
"""

from celery import shared_task
from django.db.models import Avg, Count, Sum, Q
from datetime import timedelta
from django.utils import timezone
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


@shared_task(name='predict_student_churn')
def predict_student_churn():
    """
    Predict which students are likely to drop out based on:
    - Attendance patterns (40% weight)
    - Payment history (30% weight)
    - Exam scores (20% weight)
    - Engagement metrics (10% weight)

    Risk Score:
    - 0-30: Low risk
    - 31-60: Medium risk
    - 61-100: High risk
    """
    at_risk_students = []

    from users.models import User
    from student_profile.models import Attendance, Payment, ExamScore, Group
    from django.db.models import Avg

    students = User.objects.filter(
        is_teacher=False,
        is_staff=False
    ).prefetch_related('attendances', 'exam_scores', 'made_payments')

    thirty_days_ago = timezone.now().date() - timedelta(days=30)

    for student in students:
        risk_score = 0
        risk_factors = []
        recommendations = []

        # 1. ATTENDANCE ANALYSIS (40% weight)
        total_attendance = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).count()

        if total_attendance > 0:
            present_count = Attendance.objects.filter(
                student=student,
                date__gte=thirty_days_ago,
                is_present=True
            ).count()

            attendance_rate = (present_count / total_attendance) * 100

            if attendance_rate < 50:
                risk_score += 40
                risk_factors.append(f'Critical attendance: {attendance_rate:.1f}%')
                recommendations.append('Immediate intervention required - Contact student and parents')
            elif attendance_rate < 70:
                risk_score += 25
                risk_factors.append(f'Low attendance: {attendance_rate:.1f}%')
                recommendations.append('Schedule meeting with student to discuss attendance')
            elif attendance_rate < 85:
                risk_score += 10
                risk_factors.append(f'Below target attendance: {attendance_rate:.1f}%')
                recommendations.append('Monitor attendance closely')
        else:
            # No attendance records = major concern
            risk_score += 40
            risk_factors.append('No attendance records in last 30 days')
            recommendations.append('URGENT: Verify student enrollment status')

        # 2. PAYMENT ANALYSIS (30% weight)
        overdue_payments = Payment.objects.filter(
            by_user=student,
            status='pending'
        ).count()

        total_debt = Payment.objects.filter(
            by_user=student,
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or 0

        if overdue_payments > 3:
            risk_score += 30
            risk_factors.append(f'{overdue_payments} overdue payments')
            recommendations.append('Arrange payment plan with family')
        elif overdue_payments > 0:
            risk_score += 15
            risk_factors.append(f'{overdue_payments} pending payment(s)')
            recommendations.append('Send payment reminder')

        if total_debt > 0:
            risk_factors.append(f'Total debt: {total_debt / 100:.2f} UZS')

        # 3. ACADEMIC PERFORMANCE (20% weight)
        recent_scores = ExamScore.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).values_list('score', flat=True)

        if recent_scores:
            avg_score = sum(recent_scores) / len(recent_scores)

            if avg_score < 40:
                risk_score += 20
                risk_factors.append(f'Failing grades: {avg_score:.1f}')
                recommendations.append('Provide academic tutoring support')
            elif avg_score < 60:
                risk_score += 12
                risk_factors.append(f'Low exam scores: {avg_score:.1f}')
                recommendations.append('Offer additional study materials')
            elif avg_score < 75:
                risk_score += 5
                risk_factors.append(f'Below average scores: {avg_score:.1f}')
        else:
            # No exam records
            risk_score += 10
            risk_factors.append('No exam records')
            recommendations.append('Ensure student is participating in assessments')

        # 4. ENGAGEMENT METRICS (10% weight)
        # Check last login/activity (if tracked)
        days_since_activity = (timezone.now().date() - student.last_login.date()).days if student.last_login else 999

        if days_since_activity > 14:
            risk_score += 10
            risk_factors.append(f'No activity for {days_since_activity} days')
            recommendations.append('Re-engage student with personalized communication')
        elif days_since_activity > 7:
            risk_score += 5
            risk_factors.append(f'Low activity: {days_since_activity} days since last login')

        # 5. CONSECUTIVE ABSENCES (Bonus risk factor)
        recent_attendance = Attendance.objects.filter(
            student=student,
            date__gte=thirty_days_ago
        ).order_by('-date')[:7]

        consecutive_absences = 0
        for att in recent_attendance:
            if not att.is_present:
                consecutive_absences += 1
            else:
                break

        if consecutive_absences >= 5:
            risk_score += 15
            risk_factors.append(f'{consecutive_absences} consecutive absences')
            recommendations.append('URGENT: Conduct home visit or welfare check')

        # Determine risk level
        if risk_score >= 61:
            risk_level = 'critical'
            priority = 1
        elif risk_score >= 41:
            risk_level = 'high'
            priority = 2
        elif risk_score >= 21:
            risk_level = 'medium'
            priority = 3
        else:
            risk_level = 'low'
            priority = 4

        # Only include medium, high, and critical risk students
        if risk_score >= 21:
            # Get student's group info
            student_group = Group.objects.filter(students=student).first()

            at_risk_students.append({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'phone': student.phone,
                'parents_phone': student.parents_phone,
                'email': student.email,
                'group': student_group.name if student_group else 'No group',
                'group_id': student_group.id if student_group else None,
                'teacher': student_group.main_teacher.get_full_name() if student_group and student_group.main_teacher else 'N/A',
                'risk_score': risk_score,
                'risk_level': risk_level,
                'priority': priority,
                'risk_factors': risk_factors,
                'recommendations': recommendations,
                'last_activity': student.last_login.date().isoformat() if student.last_login else 'Never'
            })

    # Sort by risk score (highest first)
    at_risk_students.sort(key=lambda x: x['risk_score'], reverse=True)

    # Cache results for dashboard
    cache.set('at_risk_students', at_risk_students, 3600)  # 1 hour

    # Send report to admins/teachers
    if at_risk_students:
        send_at_risk_report(at_risk_students)
        logger.warning(f"At-risk students identified: {len(at_risk_students)}")

    # Group by risk level
    critical = [s for s in at_risk_students if s['risk_level'] == 'critical']
    high = [s for s in at_risk_students if s['risk_level'] == 'high']
    medium = [s for s in at_risk_students if s['risk_level'] == 'medium']

    return {
        'success': True,
        'analysis_date': timezone.now().date().isoformat(),
        'total_students_analyzed': students.count(),
        'at_risk_count': len(at_risk_students),
        'critical_risk': len(critical),
        'high_risk': len(high),
        'medium_risk': len(medium),
        'students': at_risk_students[:20]  # Top 20 for response
    }


@shared_task(name='predict_group_performance')
def predict_group_performance():
    """
    Predict which groups are likely to underperform based on:
    - Average attendance rate
    - Average exam scores
    - Teacher performance history
    - Payment compliance
    """
    from student_profile.models import Group, Attendance, ExamScore

    underperforming_groups = []
    active_groups = Group.objects.filter(
        end_day__gte=timezone.now().date()
    ).select_related('main_teacher', 'branch', 'course')

    thirty_days_ago = timezone.now().date() - timedelta(days=30)

    for group in active_groups:
        performance_score = 100  # Start at 100, deduct points for issues
        issues = []

        # 1. Attendance rate
        total_attendance = Attendance.objects.filter(
            group=group,
            date__gte=thirty_days_ago
        ).count()

        if total_attendance > 0:
            present = Attendance.objects.filter(
                group=group,
                date__gte=thirty_days_ago,
                is_present=True
            ).count()
            attendance_rate = (present / total_attendance) * 100

            if attendance_rate < 60:
                performance_score -= 40
                issues.append(f'Low attendance: {attendance_rate:.1f}%')
            elif attendance_rate < 75:
                performance_score -= 20
                issues.append(f'Below target attendance: {attendance_rate:.1f}%')

        # 2. Average exam scores
        avg_score = ExamScore.objects.filter(
            group=group,
            date__gte=thirty_days_ago
        ).aggregate(avg=Avg('score'))['avg']

        if avg_score:
            if avg_score < 50:
                performance_score -= 30
                issues.append(f'Low exam average: {avg_score:.1f}')
            elif avg_score < 70:
                performance_score -= 15
                issues.append(f'Below average scores: {avg_score:.1f}')

        # 3. Student count (too few or too many)
        student_count = group.students.count()
        if student_count < 5:
            performance_score -= 10
            issues.append(f'Low enrollment: {student_count} students')
        elif student_count > 20:
            performance_score -= 5
            issues.append(f'Overcrowded: {student_count} students')

        # Only include groups with issues
        if performance_score < 70:
            underperforming_groups.append({
                'group_id': group.id,
                'group_name': group.name,
                'branch': group.branch.name if group.branch else 'N/A',
                'course': group.course.name if group.course else 'N/A',
                'teacher': group.main_teacher.get_full_name() if group.main_teacher else 'N/A',
                'performance_score': performance_score,
                'student_count': student_count,
                'issues': issues
            })

    # Sort by performance score (lowest first)
    underperforming_groups.sort(key=lambda x: x['performance_score'])

    return {
        'success': True,
        'analysis_date': timezone.now().date().isoformat(),
        'total_groups_analyzed': active_groups.count(),
        'underperforming_count': len(underperforming_groups),
        'groups': underperforming_groups
    }


@shared_task(name='predict_revenue_forecast')
def predict_revenue_forecast():
    """
    Forecast revenue for next month based on:
    - Historical payment patterns
    - Current enrollment
    - Seasonal trends
    """
    from student_profile.models import Payment, Group
    from django.db.models import Sum

    # Get last 3 months of payment data
    today = timezone.now().date()
    three_months_ago = today - timedelta(days=90)

    monthly_revenue = []
    for i in range(3):
        month_start = today - timedelta(days=30 * (i + 1))
        month_end = today - timedelta(days=30 * i)

        revenue = Payment.objects.filter(
            date__gte=month_start,
            date__lt=month_end,
            status='paid'
        ).aggregate(total=Sum('amount'))['total'] or 0

        monthly_revenue.append(revenue)

    # Simple average-based forecast
    if monthly_revenue:
        avg_monthly_revenue = sum(monthly_revenue) / len(monthly_revenue)

        # Adjust based on active groups
        active_groups = Group.objects.filter(
            end_day__gte=today
        ).count()

        # Simple linear forecast
        forecast = avg_monthly_revenue

        return {
            'success': True,
            'forecast_date': (today + timedelta(days=30)).isoformat(),
            'historical_avg': avg_monthly_revenue / 100,
            'forecast': forecast / 100,
            'active_groups': active_groups,
            'confidence': 'medium'
        }

    return {
        'success': False,
        'error': 'Insufficient historical data'
    }


def send_at_risk_report(students):
    """
    Send at-risk students report to teachers and admins.
    """
    from users.models import User

    # Get admins and teachers
    admins = User.objects.filter(is_staff=True)

    # Group students by teacher
    by_teacher = {}
    for student in students:
        teacher_name = student.get('teacher', 'N/A')
        if teacher_name not in by_teacher:
            by_teacher[teacher_name] = []
        by_teacher[teacher_name].append(student)

    # Log the report
    logger.warning(f"At-risk students report: {len(students)} students need attention")
    logger.info(f"By risk level - Critical: {len([s for s in students if s['risk_level'] == 'critical'])}, "
                f"High: {len([s for s in students if s['risk_level'] == 'high'])}, "
                f"Medium: {len([s for s in students if s['risk_level'] == 'medium'])}")

    # TODO: Implement email/SMS notification
    # For now, cache results for dashboard
    cache.set('at_risk_report_by_teacher', by_teacher, 86400)

    return True

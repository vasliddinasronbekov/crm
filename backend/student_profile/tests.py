"""
Comprehensive tests for student profile API endpoints and models.
"""

import importlib.util
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

from .models import Branch, Course, Attendance, Payment, Group, PaymentType, Room
from .content_models import Lesson

User = get_user_model()


def _list_results(payload):
    if isinstance(payload, list):
        return payload
    return payload.get('results', [])


@pytest.mark.django_db
@pytest.mark.integration
class TestCourseModel:
    """Test suite for Course model."""

    def test_create_course(self):
        """Test creating a course."""
        course = Course.objects.create(
            name='Python Programming',
            description='Learn Python from scratch',
            price=500000,
            duration_months=6
        )

        assert course.name == 'Python Programming'
        assert course.price == 500000
        assert course.is_active is True
        assert str(course) == 'Python Programming'

@pytest.mark.django_db
class TestLessonModel:
    """Test suite for Lesson model."""

    def test_create_lesson(self):
        """Test creating a lesson."""
        course = Course.objects.create(name='English Course', price=400000)
        lesson = Lesson.objects.create(
            course=course,
            title='Introduction to Grammar',
            description='Basic grammar concepts',
            order=1
        )

        assert lesson.course == course
        assert lesson.title == 'Introduction to Grammar'
        assert lesson.order == 1
        assert str(lesson) == 'Introduction to Grammar'



@pytest.mark.django_db
@pytest.mark.unit
class TestAttendanceModel:
    """Test suite for Attendance model."""

    def test_create_attendance_record(self, user):
        """Test creating attendance record."""
        course = Course.objects.create(name='History', price=250000)
        group = Group.objects.create(name='History Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='09:00', end_time='10:00', days='Mon,Wed,Fri')

        attendance = Attendance.objects.create(
            student=user,
            group=group,
            date='2024-01-01',
            is_present=True
        )

        assert attendance.student == user
        assert attendance.group == group
        assert attendance.is_present is True

    def test_attendance_status_choices(self, user):
        """Test attendance status has valid choices."""
        course = Course.objects.create(name='Geography', price=280000)
        group = Group.objects.create(name='Geography Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='11:00', end_time='12:00', days='Tue,Thu')

        attendance = Attendance.objects.create(
            student=user,
            group=group,
            date='2024-01-02',
            is_present=False # Test with an absent status
        )
        assert attendance.is_present is False

        attendance = Attendance.objects.create(
            student=user,
            group=group,
            date='2024-01-03',
            is_present=True # Test with a present status
        )
        assert attendance.is_present is True


@pytest.mark.django_db
@pytest.mark.unit
class TestPaymentModel:
    """Test suite for Payment model."""

    def test_create_payment(self, user):
        """Test creating payment record."""
        course = Course.objects.create(name='Art', price=450000)
        group = Group.objects.create(name='Art Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='09:00', end_time='10:00', days='Mon,Wed,Fri')
        payment_type = PaymentType.objects.create(name='Cash')

        payment = Payment.objects.create(
            by_user=user,
            group=group,
            amount=450000,
            payment_type=payment_type,
            status='paid',
            course_price=course.price
        )

        assert payment.by_user == user
        assert payment.group == group
        assert payment.amount == 450000
        assert payment.status == 'paid'

    def test_payment_status_defaults_to_pending(self, user):
        """Test payment status defaults to pending."""
        course = Course.objects.create(name='Music', price=420000)
        group = Group.objects.create(name='Music Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='10:00', end_time='11:00', days='Tue,Thu')
        payment_type = PaymentType.objects.create(name='Bank Transfer')

        payment = Payment.objects.create(
            by_user=user,
            group=group,
            amount=420000,
            payment_type=payment_type,
            course_price=course.price
        )

        assert payment.status == 'pending'

    def test_partial_payment(self, user):
        """Test creating partial payment."""
        course = Course.objects.create(name='Dance', price=500000)
        group = Group.objects.create(name='Dance Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='12:00', end_time='13:00', days='Mon,Wed,Fri')
        payment_type = PaymentType.objects.create(name='Cash')

        # First payment - partial
        payment1 = Payment.objects.create(
            by_user=user,
            group=group,
            amount=250000,
            payment_type=payment_type,
            status='paid',
            course_price=course.price
        )

        # Second payment - remaining
        payment2 = Payment.objects.create(
            by_user=user,
            group=group,
            amount=250000,
            payment_type=payment_type,
            status='paid',
            course_price=course.price
        )

        total_paid = payment1.amount + payment2.amount
        assert total_paid == course.price


class TestStudentProfileStatistics:
    """Test suite for student statistics and rankings."""
    def test_student_attendance_rate(self, user):
        """Test calculating student attendance rate."""
        course = Course.objects.create(name='History', price=250000)
        group = Group.objects.create(name='History Group', course=course, start_day='2024-01-01', end_day='2024-06-01', start_time='09:00', end_time='10:00', days='Mon,Wed,Fri')

        # Create attendance records
        Attendance.objects.create(student=user, group=group, date='2024-01-01', is_present=True)
        Attendance.objects.create(student=user, group=group, date='2024-01-02', is_present=True)
        Attendance.objects.create(student=user, group=group, date='2024-01-03', is_present=False)
        Attendance.objects.create(student=user, group=group, date='2024-01-04', is_present=False)

        total_attendance = Attendance.objects.filter(student=user).count()
        present_count = Attendance.objects.filter(
            student=user,
            is_present=True
        ).count()

        attendance_rate = (present_count / total_attendance) * 100
        assert attendance_rate == 50.0 # Changed from 75.0 to 50.0 due to new data


@pytest.mark.django_db
class TestGroupViewSetAccess:
    def test_staff_without_branch_sees_all_groups_with_nested_schedule_data(self, api_client):
        branch = Branch.objects.create(name='Chilonzor')
        course = Course.objects.create(name='IELTS Intensive', price=900000)
        teacher = User.objects.create_user(
            username='teacher_john',
            password='TestPass123!',
            is_teacher=True,
        )
        room = Room.objects.create(name='Room A', capacity=18, branch=branch)
        group = Group.objects.create(
            name='IELTS Morning',
            branch=branch,
            course=course,
            room=room,
            main_teacher=teacher,
            start_day='2026-02-01',
            end_day='2026-05-01',
            start_time='09:00',
            end_time='11:00',
            days='Mon, Wed, Fri',
        )

        staff_user = User.objects.create_user(
            username='staff_without_branch',
            password='TestPass123!',
            is_staff=True,
        )

        api_client.force_authenticate(user=staff_user)
        response = api_client.get('/api/student-profile/groups/')

        assert response.status_code == status.HTTP_200_OK
        results = _list_results(response.json())
        assert len(results) == 1
        payload = results[0]
        assert payload['id'] == group.id
        assert payload['course']['id'] == course.id
        assert payload['course']['name'] == course.name
        assert payload['room']['id'] == room.id
        assert payload['room']['name'] == room.name
        assert payload['main_teacher']['id'] == teacher.id
        assert payload['main_teacher']['username'] == teacher.username
        assert payload['student_count'] == 0

    def test_teacher_sees_groups_they_teach(self, api_client):
        branch = Branch.objects.create(name='Yunusobod')
        course = Course.objects.create(name='SAT Math', price=800000)
        teacher = User.objects.create_user(
            username='teacher_mary',
            password='TestPass123!',
            is_teacher=True,
        )
        other_teacher = User.objects.create_user(
            username='teacher_other',
            password='TestPass123!',
            is_teacher=True,
        )

        visible_group = Group.objects.create(
            name='SAT Morning',
            branch=branch,
            course=course,
            main_teacher=teacher,
            start_day='2026-02-01',
            end_day='2026-05-01',
            start_time='08:00',
            end_time='10:00',
            days='Tue, Thu',
        )
        Group.objects.create(
            name='SAT Evening',
            branch=branch,
            course=course,
            main_teacher=other_teacher,
            start_day='2026-02-01',
            end_day='2026-05-01',
            start_time='18:00',
            end_time='20:00',
            days='Mon, Wed',
        )

        api_client.force_authenticate(user=teacher)
        response = api_client.get('/api/student-profile/groups/')

        assert response.status_code == status.HTTP_200_OK
        results = _list_results(response.json())
        assert [item['id'] for item in results] == [visible_group.id]


def _expose_test_module(module_name):
    test_path = Path(__file__).with_name("tests") / f"{module_name}.py"
    if not test_path.exists():
        return

    spec = importlib.util.spec_from_file_location(f"student_profile.{module_name}", test_path)
    if not spec or not spec.loader:
        return

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    globals()[module_name] = module


for _module_name in (
    "test_exam_quality_reports",
    "test_learning_runtime_flows",
    "test_lms_module_compatibility",
    "test_sat_ai_feedback",
    "test_financial_automation",
    "test_coin_flows",
    "test_deactivation",
):
    _expose_test_module(_module_name)

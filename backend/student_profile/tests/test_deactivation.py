import pytest
from django.contrib.auth import get_user_model
from student_profile.models import Course, Group, Attendance
from student_profile.views import AttendanceViewSet
from student_profile.serializers import AttendanceSerializer
from rest_framework.test import APIRequestFactory
from datetime import date

User = get_user_model()

@pytest.fixture
def teacher(db):
    return User.objects.create_user(username='teacher', password='password', is_teacher=True)

@pytest.fixture
def student(db):
    return User.objects.create_user(username='student', password='password')

@pytest.fixture
def course(db):
    return Course.objects.create(name='Test Course', price=100, duration_months=1)

@pytest.fixture
def group(db, course, student):
    group = Group.objects.create(name='Test Group', course=course, start_day='2024-01-01', end_day='2024-12-31', start_time='10:00', end_time='11:00', days='Mon')
    group.students.add(student)
    return group

@pytest.mark.django_db
def test_student_not_deactivated_after_two_absences(teacher, student, group):
    factory = APIRequestFactory()
    view = AttendanceViewSet.as_view({'post': 'create'})

    # Log two absences
    data1 = {'student': student.id, 'group': group.id, 'date': '2024-01-01', 'is_present': False}
    request1 = factory.post('/api/v1/mentor/attendance/', data1)
    request1.user = teacher
    view(request1)

    data2 = {'student': student.id, 'group': group.id, 'date': '2024-01-02', 'is_present': False}
    request2 = factory.post('/api/v1/mentor/attendance/', data2)
    request2.user = teacher
    view(request2)

    # The user should still be active
    student.refresh_from_db()
    assert student.is_active is True

@pytest.mark.django_db
def test_student_deactivated_after_three_absences(teacher, student, group):
    factory = APIRequestFactory()
    view = AttendanceViewSet.as_view({'post': 'create'})

    # Log three absences
    data1 = {'student': student.id, 'group': group.id, 'date': '2024-01-01', 'is_present': False}
    request1 = factory.post('/api/v1/mentor/attendance/', data1)
    request1.user = teacher
    view(request1)

    data2 = {'student': student.id, 'group': group.id, 'date': '2024-01-02', 'is_present': False}
    request2 = factory.post('/api/v1/mentor/attendance/', data2)
    request2.user = teacher
    view(request2)

    data3 = {'student': student.id, 'group': group.id, 'date': '2024-01-03', 'is_present': False}
    request3 = factory.post('/api/v1/mentor/attendance/', data3)
    request3.user = teacher
    view(request3)

    # The user should now be inactive
    student.refresh_from_db()
    assert student.is_active is False

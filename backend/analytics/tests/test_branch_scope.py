from datetime import date, time, timedelta

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch, Course, Group
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _create_group(*, branch: Branch, teacher: User, name: str) -> Group:
    course = Course.objects.create(
        name=f'{name} Course',
        description='Scoped analytics course',
        price=60_000_000,
    )
    today = date.today()
    return Group.objects.create(
        name=name,
        branch=branch,
        course=course,
        main_teacher=teacher,
        start_day=today,
        end_day=today + timedelta(days=90),
        start_time=time(9, 0),
        end_time=time(10, 0),
        days='monday,wednesday,friday',
    )


@pytest.mark.django_db
def test_dashboard_stats_respects_branch_query_for_superuser():
    branch_a = Branch.objects.create(name='Analytics Branch A')
    branch_b = Branch.objects.create(name='Analytics Branch B')

    superuser = User.objects.create_superuser(
        username='analytics_scope_admin',
        password='StrongPass123!',
        email='analytics_scope_admin@example.com',
    )

    teacher_a = User.objects.create_user(
        username='analytics_teacher_a',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_a,
    )
    teacher_b = User.objects.create_user(
        username='analytics_teacher_b',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_b,
    )

    User.objects.create_user(
        username='analytics_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    User.objects.create_user(
        username='analytics_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    _create_group(branch=branch_a, teacher=teacher_a, name='Analytics Group A')
    _create_group(branch=branch_b, teacher=teacher_b, name='Analytics Group B')

    client = _auth_client_for_user(superuser)
    response = client.get(f'/api/analytics/dashboard-stats/?branch={branch_a.id}')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['total_students'] == 1
    assert response.data['total_groups'] == 1


@pytest.mark.django_db
def test_reports_list_falls_back_to_own_reports_when_user_has_no_branch():
    staff_user = User.objects.create_user(
        username='reports_scope_no_branch',
        password='StrongPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    other_staff = User.objects.create_user(
        username='reports_scope_no_branch_other',
        password='StrongPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    client = _auth_client_for_user(staff_user)
    other_client = _auth_client_for_user(other_staff)

    first = client.post(
        '/api/analytics/reports/generate/',
        {'report_type': 'student-performance', 'period': 'month'},
        format='json',
    )
    assert first.status_code == status.HTTP_201_CREATED

    second = other_client.post(
        '/api/analytics/reports/generate/',
        {'report_type': 'student-performance', 'period': 'month'},
        format='json',
    )
    assert second.status_code == status.HTTP_201_CREATED

    list_response = client.get('/api/analytics/reports/')
    assert list_response.status_code == status.HTTP_200_OK
    report_ids = {item['report_id'] for item in list_response.data['results']}
    assert first.data['report_id'] in report_ids
    assert second.data['report_id'] not in report_ids

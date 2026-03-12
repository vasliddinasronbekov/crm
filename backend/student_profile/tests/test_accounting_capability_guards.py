import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.accounting_models import FinancialSummary
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_student_cannot_access_realtime_accounting_dashboard():
    student = User.objects.create_user(
        username='student_accounting_dashboard_denied',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    client = _auth_client_for_user(student)

    response = client.get('/api/v1/student-profile/accounting/realtime-dashboard/')

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_can_access_realtime_accounting_dashboard():
    teacher = User.objects.create_user(
        username='teacher_accounting_dashboard_allowed',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    client = _auth_client_for_user(teacher)

    response = client.get('/api/v1/student-profile/accounting/realtime-dashboard/')

    assert response.status_code == status.HTTP_200_OK, response.data
    assert 'recent_logs' in response.data
    assert 'total_income_tiyin' in response.data


@pytest.mark.django_db
def test_teacher_cannot_apply_manual_fine():
    teacher = User.objects.create_user(
        username='teacher_manual_fine_denied',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    client = _auth_client_for_user(teacher)

    response = client.post(
        '/api/v1/student-profile/accounting/student-fines/apply_fine/',
        {},
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_staff_reaches_manual_fine_validation_layer():
    staff_user = User.objects.create_user(
        username='staff_manual_fine_allowed',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    client = _auth_client_for_user(staff_user)

    response = client.post(
        '/api/v1/student-profile/accounting/student-fines/apply_fine/',
        {},
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_student_cannot_access_financial_summaries():
    student = User.objects.create_user(
        username='student_financial_summaries_denied',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    client = _auth_client_for_user(student)

    response = client.get('/api/v1/student-profile/accounting/financial-summaries/')

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_can_access_financial_summaries():
    teacher = User.objects.create_user(
        username='teacher_financial_summaries_allowed',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    client = _auth_client_for_user(teacher)

    response = client.get('/api/v1/student-profile/accounting/financial-summaries/')

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_staff_cannot_recalculate_financial_summary():
    staff_user = User.objects.create_user(
        username='staff_financial_recalc_denied',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    summary = FinancialSummary.objects.create(date='2026-03-11')
    client = _auth_client_for_user(staff_user)

    response = client.post(
        f'/api/v1/student-profile/accounting/financial-summaries/{summary.id}/recalculate/',
        {},
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_manager_can_recalculate_financial_summary():
    manager_user = User.objects.create_user(
        username='manager_financial_recalc_allowed',
        password='TestPass123!',
        role=UserRoleEnum.MANAGER.value,
    )
    summary = FinancialSummary.objects.create(date='2026-03-11')
    client = _auth_client_for_user(manager_user)

    response = client.post(
        f'/api/v1/student-profile/accounting/financial-summaries/{summary.id}/recalculate/',
        {},
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert 'summary' in response.data

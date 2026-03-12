import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_teacher_can_view_scheduled_reports():
    teacher = User.objects.create_user(
        username='teacher_reports_view_allowed',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    client = _auth_client_for_user(teacher)

    response = client.get('/api/v1/student-profile/reports/scheduled-reports/')

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_student_cannot_view_scheduled_reports():
    student = User.objects.create_user(
        username='student_reports_view_denied',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    client = _auth_client_for_user(student)

    response = client.get('/api/v1/student-profile/reports/scheduled-reports/')

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_cannot_send_bulk_payment_reminders():
    teacher = User.objects.create_user(
        username='teacher_bulk_reminder_denied',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    client = _auth_client_for_user(teacher)

    response = client.post(
        '/api/v1/student-profile/reports/bulk-reminders/',
        {'payment_ids': []},
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_staff_can_access_pending_payments_for_reminders():
    staff_user = User.objects.create_user(
        username='staff_pending_reminders_allowed',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    client = _auth_client_for_user(staff_user)

    response = client.get('/api/v1/student-profile/reports/pending-payments/')

    assert response.status_code == status.HTTP_200_OK
    assert 'payments' in response.data

import pytest
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_staff_can_generate_list_detail_and_download_reports():
    staff_user = User.objects.create_user(
        username='reports_staff_user',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    client = _auth_client_for_user(staff_user)

    generate_response = client.post(
        '/api/analytics/reports/generate/',
        {
            'report_type': 'student-performance',
            'period': 'month',
        },
        format='json',
    )
    assert generate_response.status_code == status.HTTP_201_CREATED
    report_id = generate_response.data['report_id']

    list_response = client.get('/api/analytics/reports/')
    assert list_response.status_code == status.HTTP_200_OK
    assert list_response.data['count'] >= 1
    listed_report_ids = {row['report_id'] for row in list_response.data['results']}
    assert report_id in listed_report_ids

    detail_response = client.get(f'/api/analytics/reports/{report_id}/')
    assert detail_response.status_code == status.HTTP_200_OK
    assert detail_response.data['report_id'] == report_id

    match = resolve(f'/api/analytics/reports/{report_id}/download/')
    assert match.view_name == 'reports-download'
    assert match.func.view_class.__name__ == 'ReportDownloadView'

    csv_download = client.get(f'/api/analytics/reports/{report_id}/download/', {'file_format': 'csv'})
    assert csv_download.status_code == status.HTTP_200_OK, getattr(csv_download, 'data', None)
    assert csv_download['Content-Type'].startswith('text/csv')

    json_download = client.get(f'/api/analytics/reports/{report_id}/download/', {'file_format': 'json'})
    assert json_download.status_code == status.HTTP_200_OK
    assert json_download['Content-Type'].startswith('application/json')


@pytest.mark.django_db
def test_student_cannot_access_staff_reports_endpoints():
    student_user = User.objects.create_user(
        username='reports_student_user',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    client = _auth_client_for_user(student_user)

    list_response = client.get('/api/analytics/reports/')
    assert list_response.status_code == status.HTTP_403_FORBIDDEN

    generate_response = client.post(
        '/api/analytics/reports/generate/',
        {
            'report_type': 'student-performance',
            'period': 'month',
        },
        format='json',
    )
    assert generate_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_can_access_dashboard_stats_with_capability_guard():
    teacher_user = User.objects.create_user(
        username='analytics_teacher_user',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
    )
    client = _auth_client_for_user(teacher_user)

    response = client.get('/api/analytics/dashboard-stats/')
    assert response.status_code == status.HTTP_200_OK
    assert 'total_students' in response.data


@pytest.mark.django_db
def test_generate_report_rejects_unknown_report_type():
    staff_user = User.objects.create_user(
        username='reports_staff_unknown_type',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    client = _auth_client_for_user(staff_user)

    response = client.post(
        '/api/analytics/reports/generate/',
        {
            'report_type': 'unknown-type',
            'period': 'month',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST

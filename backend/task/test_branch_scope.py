import pytest
from datetime import date
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch, Course, Group
from users.models import BranchMembership, User, UserRoleEnum

from .models import Board, List, Task
from .certificate_models import Certificate, CertificateVerification


def _auth_client_for_user(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.mark.django_db
def test_task_endpoints_are_branch_scoped(api_client):
    branch_a = Branch.objects.create(name='Task Branch A')
    branch_b = Branch.objects.create(name='Task Branch B')

    manager = User.objects.create_user(
        username='task_scope_manager',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
    )
    BranchMembership.objects.create(
        user=manager,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    teacher_a = User.objects.create_user(
        username='task_scope_teacher_a',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_a,
    )
    teacher_b = User.objects.create_user(
        username='task_scope_teacher_b',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_b,
    )

    board_a = Board.objects.create(name='Scoped Board A')
    board_a.users.add(manager)
    board_a.teachers.add(teacher_a)
    board_b = Board.objects.create(name='Scoped Board B')
    board_b.teachers.add(teacher_b)

    list_a = List.objects.create(name='Scoped List A', board=board_a)
    list_b = List.objects.create(name='Scoped List B', board=board_b)

    task_a = Task.objects.create(user=teacher_a, title='Visible Task', list=list_a)
    task_b = Task.objects.create(user=teacher_b, title='Hidden Task', list=list_b)

    client = _auth_client_for_user(api_client, manager)

    list_response = client.get('/api/task/tasks/')
    assert list_response.status_code == status.HTTP_200_OK
    payload = list_response.data['results'] if isinstance(list_response.data, dict) else list_response.data
    result_ids = {item['id'] for item in payload}
    assert task_a.id in result_ids
    assert task_b.id not in result_ids

    cross_branch_list_response = client.post(
        '/api/task/lists/',
        {'name': 'Cross Branch List', 'board': board_b.id, 'order': 1},
        format='json',
    )
    assert cross_branch_list_response.status_code == status.HTTP_403_FORBIDDEN

    bulk_response = client.post(
        '/api/task/tasks-create/',
        {
            'title': 'Bulk Scoped Task',
            'description': 'Branch guard',
            'list': list_a.id,
            'users': [teacher_a.id, teacher_b.id],
        },
        format='json',
    )
    assert bulk_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_certificate_endpoints_are_branch_scoped(api_client):
    branch_a = Branch.objects.create(name='Certificate Branch A')
    branch_b = Branch.objects.create(name='Certificate Branch B')

    manager = User.objects.create_user(
        username='cert_scope_manager',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    student_a = User.objects.create_user(
        username='cert_scope_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    student_b = User.objects.create_user(
        username='cert_scope_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    course_a = Course.objects.create(name='Course A', price=500_000, duration_months=1)
    course_b = Course.objects.create(name='Course B', price=500_000, duration_months=1)

    Group.objects.create(
        name='Group A',
        branch=branch_a,
        course=course_a,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='09:00',
        end_time='10:00',
        days='Mon,Wed,Fri',
    )
    Group.objects.create(
        name='Group B',
        branch=branch_b,
        course=course_b,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='11:00',
        end_time='12:00',
        days='Tue,Thu,Sat',
    )

    cert_a = Certificate.objects.create(
        student=student_a,
        course=course_a,
        completion_date=date(2026, 3, 1),
        issued_by=manager,
    )
    cert_b = Certificate.objects.create(
        student=student_b,
        course=course_b,
        completion_date=date(2026, 3, 1),
        issued_by=student_b,
    )

    CertificateVerification.objects.create(certificate=cert_a)
    CertificateVerification.objects.create(certificate=cert_b)

    client = _auth_client_for_user(api_client, manager)

    cert_response = client.get('/api/task/certificates/')
    assert cert_response.status_code == status.HTTP_200_OK
    cert_payload = cert_response.data['results'] if isinstance(cert_response.data, dict) else cert_response.data
    cert_ids = {item['id'] for item in cert_payload}
    assert cert_a.id in cert_ids
    assert cert_b.id not in cert_ids

    verify_response = client.get('/api/task/certificate-verifications/')
    assert verify_response.status_code == status.HTTP_200_OK
    verify_payload = verify_response.data['results'] if isinstance(verify_response.data, dict) else verify_response.data
    scoped_cert_ids = {item['certificate']['id'] for item in verify_payload}
    assert cert_a.id in scoped_cert_ids
    assert cert_b.id not in scoped_cert_ids

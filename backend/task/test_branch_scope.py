import pytest
from datetime import date
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch, Course, Group
from users.models import BranchMembership, User, UserRoleEnum

from .models import Board, List, Task
from .certificate_models import Certificate, CertificateTemplate, CertificateVerification


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
def test_task_board_list_excludes_legacy_cross_branch_members(api_client):
    branch_a = Branch.objects.create(name='Task Legacy Board Branch A')
    branch_b = Branch.objects.create(name='Task Legacy Board Branch B')

    manager = User.objects.create_user(
        username='task_legacy_board_manager',
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

    in_scope_teacher = User.objects.create_user(
        username='task_legacy_board_teacher_a',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_a,
    )
    out_scope_teacher = User.objects.create_user(
        username='task_legacy_board_teacher_b',
        password='StrongPass123!',
        role=UserRoleEnum.TEACHER.value,
        is_teacher=True,
        branch=branch_b,
    )

    in_scope_board = Board.objects.create(name='Task In Scope Board')
    in_scope_board.users.add(manager)
    in_scope_board.teachers.add(in_scope_teacher)

    legacy_cross_branch_board = Board.objects.create(name='Task Legacy Cross Branch Board')
    legacy_cross_branch_board.users.add(manager)
    legacy_cross_branch_board.teachers.add(out_scope_teacher)

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/task/boards/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    board_ids = {item['id'] for item in payload}
    assert in_scope_board.id in board_ids
    assert legacy_cross_branch_board.id not in board_ids


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


@pytest.mark.django_db
def test_certificate_template_ownership_is_branch_scoped(api_client):
    branch_a = Branch.objects.create(name='Template Scope Branch A')
    branch_b = Branch.objects.create(name='Template Scope Branch B')

    manager_a = User.objects.create_user(
        username='template_scope_manager_a',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_a,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    manager_b = User.objects.create_user(
        username='template_scope_manager_b',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_b,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_b,
        branch=branch_b,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    template_a = CertificateTemplate.objects.create(
        name='Branch A Template',
        branch=branch_a,
        created_by=manager_a,
        is_default=True,
    )
    template_a_2 = CertificateTemplate.objects.create(
        name='Branch A Template 2',
        branch=branch_a,
        created_by=manager_a,
        is_default=False,
    )
    template_b = CertificateTemplate.objects.create(
        name='Branch B Template',
        branch=branch_b,
        created_by=manager_b,
        is_default=True,
    )

    client = _auth_client_for_user(api_client, manager_a)

    list_response = client.get('/api/task/certificate-templates/')
    assert list_response.status_code == status.HTTP_200_OK
    payload = list_response.data['results'] if isinstance(list_response.data, dict) else list_response.data
    template_ids = {item['id'] for item in payload}
    assert template_a.id in template_ids
    assert template_b.id not in template_ids

    create_response = client.post(
        '/api/task/certificate-templates/',
        {
            'name': 'New Branch A Template',
            'template_type': 'standard',
            'branch': branch_b.id,
        },
        format='json',
    )
    assert create_response.status_code == status.HTTP_403_FORBIDDEN

    set_default_response = client.post(
        f'/api/task/certificate-templates/{template_a_2.id}/set_default/',
        format='json',
    )
    assert set_default_response.status_code == status.HTTP_200_OK

    template_a.refresh_from_db()
    template_a_2.refresh_from_db()
    template_b.refresh_from_db()
    assert template_a.is_default is False
    assert template_a_2.is_default is True
    assert template_b.is_default is True


@pytest.mark.django_db
def test_certificate_generation_rejects_out_of_scope_template(api_client):
    branch_a = Branch.objects.create(name='Certificate Create Branch A')
    branch_b = Branch.objects.create(name='Certificate Create Branch B')

    manager = User.objects.create_user(
        username='cert_create_scope_manager',
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

    student = User.objects.create_user(
        username='cert_create_scope_student',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )

    course = Course.objects.create(name='Scoped Course', price=500_000, duration_months=1)
    Group.objects.create(
        name='Scoped Course Group',
        branch=branch_a,
        course=course,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='09:00',
        end_time='10:00',
        days='Mon,Wed,Fri',
    )

    out_of_scope_template = CertificateTemplate.objects.create(
        name='Out Scope Template',
        branch=branch_b,
        template_type='standard',
        is_active=True,
    )

    client = _auth_client_for_user(api_client, manager)
    response = client.post(
        '/api/task/certificates/',
        {
            'student_id': student.id,
            'course_id': course.id,
            'template_id': out_of_scope_template.id,
        },
        format='json',
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_certificate_list_excludes_out_of_scope_students_even_for_shared_courses(api_client):
    branch_a = Branch.objects.create(name='Certificate Shared Course Branch A')
    branch_b = Branch.objects.create(name='Certificate Shared Course Branch B')

    manager = User.objects.create_user(
        username='cert_shared_course_manager',
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
        username='cert_shared_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    student_b = User.objects.create_user(
        username='cert_shared_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    shared_course = Course.objects.create(name='Shared Course', price=500_000, duration_months=1)
    Group.objects.create(
        name='Shared Group A',
        branch=branch_a,
        course=shared_course,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='09:00',
        end_time='10:00',
        days='Mon,Wed,Fri',
    )
    Group.objects.create(
        name='Shared Group B',
        branch=branch_b,
        course=shared_course,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='11:00',
        end_time='12:00',
        days='Tue,Thu,Sat',
    )

    visible_certificate = Certificate.objects.create(
        student=student_a,
        course=shared_course,
        completion_date=date(2026, 3, 1),
        issued_by=manager,
    )
    hidden_certificate = Certificate.objects.create(
        student=student_b,
        course=shared_course,
        completion_date=date(2026, 3, 1),
        issued_by=manager,
    )

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/task/certificates/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    cert_ids = {item['id'] for item in payload}
    assert visible_certificate.id in cert_ids
    assert hidden_certificate.id not in cert_ids


@pytest.mark.django_db
def test_certificate_generation_for_scoped_users_does_not_fallback_to_global_templates(api_client):
    branch_a = Branch.objects.create(name='Certificate Template Fallback Branch A')

    manager = User.objects.create_user(
        username='cert_template_fallback_manager',
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

    student = User.objects.create_user(
        username='cert_template_fallback_student',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )

    course = Course.objects.create(name='Fallback Scoped Course', price=500_000, duration_months=1)
    Group.objects.create(
        name='Fallback Scoped Group',
        branch=branch_a,
        course=course,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='09:00',
        end_time='10:00',
        days='Mon,Wed,Fri',
    )

    CertificateTemplate.objects.create(
        name='Global Template',
        template_type='standard',
        is_active=True,
        is_default=True,
    )

    client = _auth_client_for_user(api_client, manager)
    response = client.post(
        '/api/task/certificates/',
        {
            'student_id': student.id,
            'course_id': course.id,
        },
        format='json',
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data.get('template') is None

    certificate = Certificate.objects.get(
        student=student,
        course=course,
    )
    assert certificate.template_id is None

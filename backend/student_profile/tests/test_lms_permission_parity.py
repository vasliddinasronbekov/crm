import datetime
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from student_profile.content_models import CourseModule
from student_profile.models import Course
from student_profile.quiz_models import Assignment, AssignmentSubmission
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _build_assignment(*, created_by: User, is_published: bool = True) -> Assignment:
    course = Course.objects.create(
        name='LMS Permissions Course',
        price=9900000,
        duration_months=3,
    )
    module = CourseModule.objects.create(
        course=course,
        title='Permissions Module',
        order=1,
        is_published=is_published,
    )
    return Assignment.objects.create(
        course=course,
        module=module,
        title='Parity Assignment',
        description='Permission parity test assignment',
        instructions='Submit your response',
        due_date=timezone.now() + datetime.timedelta(days=7),
        is_published=is_published,
        created_by=created_by,
    )


@pytest.mark.django_db
def test_teacher_can_view_and_grade_assignment_submissions():
    teacher = User.objects.create_user(
        username='teacher_lms_grade',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_lms_submission',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    assignment = _build_assignment(created_by=teacher, is_published=True)
    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='My answer',
        status='submitted',
        submitted_at=timezone.now(),
    )

    client = _auth_client_for_user(teacher)

    list_response = client.get(
        '/api/v1/lms/assignment-submissions/',
        {'assignment_id': assignment.id},
    )
    assert list_response.status_code == status.HTTP_200_OK
    results = list_response.data.get('results', list_response.data)
    result_ids = {row['id'] for row in results}
    assert submission.id in result_ids

    grade_response = client.post(
        f'/api/v1/lms/assignment-submissions/{submission.id}/grade/',
        {'points_earned': '88', 'feedback': 'Good structure and clarity.'},
        format='json',
    )
    assert grade_response.status_code == status.HTTP_200_OK

    submission.refresh_from_db()
    assert submission.status == 'graded'
    assert submission.graded_by_id == teacher.id
    assert submission.points_earned == Decimal('88')


@pytest.mark.django_db
def test_student_cannot_grade_assignment_submission():
    teacher = User.objects.create_user(
        username='teacher_lms_owner',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_lms_cannot_grade',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    assignment = _build_assignment(created_by=teacher, is_published=True)
    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Student answer',
        status='submitted',
        submitted_at=timezone.now(),
    )

    client = _auth_client_for_user(student)
    response = client.post(
        f'/api/v1/lms/assignment-submissions/{submission.id}/grade/',
        {'points_earned': '50', 'feedback': 'Trying to self-grade'},
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_can_see_unpublished_assignments_but_student_cannot():
    teacher = User.objects.create_user(
        username='teacher_lms_draft_view',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_lms_draft_hidden',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    draft_assignment = _build_assignment(created_by=teacher, is_published=False)

    teacher_client = _auth_client_for_user(teacher)
    teacher_response = teacher_client.get('/api/v1/lms/assignments/')
    assert teacher_response.status_code == status.HTTP_200_OK
    teacher_results = teacher_response.data.get('results', teacher_response.data)
    teacher_ids = {row['id'] for row in teacher_results}
    assert draft_assignment.id in teacher_ids

    student_client = _auth_client_for_user(student)
    student_response = student_client.get('/api/v1/lms/assignments/')
    assert student_response.status_code == status.HTTP_200_OK
    student_results = student_response.data.get('results', student_response.data)
    student_ids = {row['id'] for row in student_results}
    assert draft_assignment.id not in student_ids

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


def _build_assignment(*, created_by: User, module: CourseModule, title: str) -> Assignment:
    return Assignment.objects.create(
        course=module.course,
        module=module,
        title=title,
        description='Assignment workspace test item',
        instructions='Complete and submit.',
        due_date=timezone.now() + datetime.timedelta(days=5),
        max_points=100,
        passing_points=60,
        is_published=True,
        created_by=created_by,
    )


@pytest.mark.django_db
def test_assignment_insights_are_scoped_to_current_student():
    teacher = User.objects.create_user(
        username='assignment_insights_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_insights_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    other_student = User.objects.create_user(
        username='assignment_insights_other',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Insights Course', price=7100000, duration_months=3)
    module = CourseModule.objects.create(course=course, title='Insights Module', order=1, is_published=True)

    first_assignment = _build_assignment(created_by=teacher, module=module, title='Essay 1')
    second_assignment = _build_assignment(created_by=teacher, module=module, title='Essay 2')

    AssignmentSubmission.objects.create(
        assignment=first_assignment,
        student=student,
        text_content='Student graded submission',
        status='graded',
        points_earned=Decimal('82'),
        submitted_at=timezone.now() - datetime.timedelta(days=1),
        graded_at=timezone.now(),
    )
    AssignmentSubmission.objects.create(
        assignment=second_assignment,
        student=student,
        text_content='Student pending submission',
        status='submitted',
        submitted_at=timezone.now(),
    )

    # Must not affect requesting student insights.
    AssignmentSubmission.objects.create(
        assignment=second_assignment,
        student=other_student,
        text_content='Other student submission',
        status='graded',
        points_earned=Decimal('95'),
        submitted_at=timezone.now(),
        graded_at=timezone.now(),
    )

    client = _auth_client_for_user(student)
    response = client.get('/api/v1/lms/assignments/my_insights/')
    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data['total_assignments'] == 2
    assert data['submitted_count'] == 2
    assert data['graded_count'] == 1
    assert data['awaiting_grade_count'] == 1
    assert data['average_score'] == 82.0
    assert len(data['recent_submissions']) == 2
    assert {item['assignment_id'] for item in data['recent_submissions']} == {first_assignment.id, second_assignment.id}


@pytest.mark.django_db
def test_assignment_submission_review_is_scoped_and_returns_grading_details():
    teacher = User.objects.create_user(
        username='assignment_review_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_review_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    other_student = User.objects.create_user(
        username='assignment_review_other',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Review Course', price=6200000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Review Module', order=1, is_published=True)
    assignment = _build_assignment(created_by=teacher, module=module, title='Essay Review')

    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Final answer text',
        status='graded',
        points_earned=Decimal('78'),
        feedback='Good structure, strengthen examples.',
        graded_by=teacher,
        submitted_at=timezone.now() - datetime.timedelta(hours=2),
        graded_at=timezone.now(),
    )

    student_client = _auth_client_for_user(student)
    student_response = student_client.get(f'/api/v1/lms/assignment-submissions/{submission.id}/review/')
    assert student_response.status_code == status.HTTP_200_OK
    assert student_response.data['grading']['points_earned'] == 78.0
    assert student_response.data['grading']['feedback'] == 'Good structure, strengthen examples.'
    assert student_response.data['submission']['status'] == 'graded'

    other_client = _auth_client_for_user(other_student)
    other_response = other_client.get(f'/api/v1/lms/assignment-submissions/{submission.id}/review/')
    assert other_response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_assignment_grade_validation_blocks_points_outside_max_range():
    teacher = User.objects.create_user(
        username='assignment_grade_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_grade_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Grade Course', price=6800000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Grade Module', order=1, is_published=True)
    assignment = _build_assignment(created_by=teacher, module=module, title='Essay Grade Validation')

    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Submission content',
        status='submitted',
        submitted_at=timezone.now(),
    )

    client = _auth_client_for_user(teacher)
    response = client.post(
        f'/api/v1/lms/assignment-submissions/{submission.id}/grade/',
        {'points_earned': '150', 'feedback': 'Out-of-range test'},
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'points_earned' in response.data


@pytest.mark.django_db
def test_grading_queue_and_bulk_grade_enforce_staff_capability():
    teacher = User.objects.create_user(
        username='assignment_queue_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_queue_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Queue Course', price=6900000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Queue Module', order=1, is_published=True)
    assignment = _build_assignment(created_by=teacher, module=module, title='Queue Assignment')

    first_submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Submission A',
        status='submitted',
        submitted_at=timezone.now(),
    )
    second_submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Submission B',
        status='submitted',
        attempt_number=2,
        submitted_at=timezone.now(),
    )

    teacher_client = _auth_client_for_user(teacher)
    queue_response = teacher_client.get(
        '/api/v1/lms/assignment-submissions/grading_queue/',
        {'assignment_id': assignment.id},
    )
    assert queue_response.status_code == status.HTTP_200_OK
    assert queue_response.data['summary']['pending'] >= 1

    bulk_response = teacher_client.post(
        '/api/v1/lms/assignment-submissions/bulk_grade/',
        {
            'submission_ids': [first_submission.id, second_submission.id],
            'grading_mode': 'rubric',
            'rubric_percent': 80,
            'rubric_label': 'Good',
            'feedback': 'Consistent quality.',
            'status': 'graded',
        },
        format='json',
    )
    assert bulk_response.status_code == status.HTTP_200_OK
    assert bulk_response.data['updated_count'] == 2

    first_submission.refresh_from_db()
    second_submission.refresh_from_db()
    assert first_submission.status == 'graded'
    assert second_submission.status == 'graded'
    assert first_submission.graded_by_id == teacher.id
    assert first_submission.points_earned == Decimal('80.00')

    student_client = _auth_client_for_user(student)
    student_queue = student_client.get('/api/v1/lms/assignment-submissions/grading_queue/')
    assert student_queue.status_code == status.HTTP_403_FORBIDDEN

    student_bulk = student_client.post(
        '/api/v1/lms/assignment-submissions/bulk_grade/',
        {'submission_ids': [first_submission.id], 'grading_mode': 'score', 'points_earned': 90},
        format='json',
    )
    assert student_bulk.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_bulk_grade_rejects_scores_above_assignment_max_points():
    teacher = User.objects.create_user(
        username='assignment_bulk_max_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_bulk_max_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Bulk Max Course', price=7100000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Bulk Max Module', order=1, is_published=True)
    assignment = _build_assignment(created_by=teacher, module=module, title='Bulk Max Assignment')
    assignment.max_points = 70
    assignment.save(update_fields=['max_points'])

    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Submission content',
        status='submitted',
        submitted_at=timezone.now(),
    )

    client = _auth_client_for_user(teacher)
    response = client.post(
        '/api/v1/lms/assignment-submissions/bulk_grade/',
        {
            'submission_ids': [submission.id],
            'grading_mode': 'score',
            'points_earned': 90,
            'feedback': 'Out of range check',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'points_earned' in response.data


@pytest.mark.django_db
def test_assignment_audit_timeline_scopes_by_submission_visibility():
    teacher = User.objects.create_user(
        username='assignment_timeline_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='assignment_timeline_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    other_student = User.objects.create_user(
        username='assignment_timeline_other',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Assignments Timeline Course', price=7200000, duration_months=3)
    module = CourseModule.objects.create(course=course, title='Timeline Module', order=1, is_published=True)
    assignment = _build_assignment(created_by=teacher, module=module, title='Timeline Assignment')

    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        text_content='Timeline answer',
        status='graded',
        points_earned=Decimal('66'),
        feedback='Needs better argument structure.',
        graded_by=teacher,
        submitted_at=timezone.now() - datetime.timedelta(hours=2),
        graded_at=timezone.now() - datetime.timedelta(hours=1),
    )

    owner_client = _auth_client_for_user(student)
    owner_response = owner_client.get(f'/api/v1/lms/assignment-submissions/{submission.id}/audit_timeline/')
    assert owner_response.status_code == status.HTTP_200_OK
    assert owner_response.data['submission_id'] == submission.id
    assert len(owner_response.data['events']) >= 2

    other_client = _auth_client_for_user(other_student)
    other_response = other_client.get(f'/api/v1/lms/assignment-submissions/{submission.id}/audit_timeline/')
    assert other_response.status_code == status.HTTP_404_NOT_FOUND

    teacher_client = _auth_client_for_user(teacher)
    teacher_response = teacher_client.get(f'/api/v1/lms/assignment-submissions/{submission.id}/audit_timeline/')
    assert teacher_response.status_code == status.HTTP_200_OK

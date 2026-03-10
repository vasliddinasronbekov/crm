import pytest
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from student_profile.content_models import CourseModule
from student_profile.models import Course
from student_profile.quiz_models import Quiz, QuizAttempt
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_quiz_list_supports_subject_difficulty_and_search_filters():
    teacher = User.objects.create_user(
        username='quiz_filter_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )

    course = Course.objects.create(name='Quiz Filter Course', price=7500000, duration_months=3)
    module = CourseModule.objects.create(course=course, title='Quiz Filter Module', order=1, is_published=True)

    english_quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='English Entry Test',
        description='Reading and grammar basics',
        quiz_type='practice',
        subject='english',
        difficulty_level='easy',
        is_published=True,
        created_by=teacher,
    )
    Quiz.objects.create(
        course=course,
        module=module,
        title='Math Logic Challenge',
        description='Algebra and advanced reasoning',
        quiz_type='exam',
        subject='math',
        difficulty_level='hard',
        is_published=False,
        created_by=teacher,
    )

    client = _auth_client_for_user(teacher)
    response = client.get(
        '/api/v1/lms/quizzes/',
        {
            'subject': 'english',
            'difficulty_level': 'easy',
            'search': 'entry',
        },
    )
    assert response.status_code == status.HTTP_200_OK
    results = response.data.get('results', response.data)
    ids = {item['id'] for item in results}
    assert english_quiz.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_student_only_sees_published_quizzes():
    teacher = User.objects.create_user(
        username='quiz_published_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_published_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Published Visibility Course', price=6500000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Visibility Module', order=1, is_published=True)

    published_quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Published Quiz',
        quiz_type='practice',
        subject='english',
        difficulty_level='medium',
        is_published=True,
        created_by=teacher,
    )
    Quiz.objects.create(
        course=course,
        module=module,
        title='Draft Quiz',
        quiz_type='practice',
        subject='english',
        difficulty_level='medium',
        is_published=False,
        created_by=teacher,
    )

    client = _auth_client_for_user(student)
    response = client.get('/api/v1/lms/quizzes/')
    assert response.status_code == status.HTTP_200_OK
    results = response.data.get('results', response.data)
    ids = {item['id'] for item in results}
    assert published_quiz.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_quiz_dashboard_summary_returns_operational_metrics():
    teacher = User.objects.create_user(
        username='quiz_summary_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_summary_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Summary Course', price=8200000, duration_months=4)
    module = CourseModule.objects.create(course=course, title='Summary Module', order=1, is_published=True)

    quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Math Weekly Assessment',
        quiz_type='graded',
        subject='math',
        difficulty_level='hard',
        is_published=True,
        created_by=teacher,
    )

    QuizAttempt.objects.create(
        quiz=quiz,
        student=student,
        attempt_number=1,
        status='graded',
        total_points=Decimal('10'),
        points_earned=Decimal('8'),
        percentage_score=Decimal('80'),
        passed=True,
    )

    client = _auth_client_for_user(teacher)
    response = client.get('/api/v1/lms/quizzes/dashboard_summary/')
    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data['total_quizzes'] == 1
    assert data['published_quizzes'] == 1
    assert data['attempts_total'] == 1
    assert data['pass_rate'] == 100.0
    assert len(data['top_quizzes']) == 1
    assert data['top_quizzes'][0]['id'] == quiz.id

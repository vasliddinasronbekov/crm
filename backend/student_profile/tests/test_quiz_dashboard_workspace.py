import pytest
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient

from student_profile.content_models import CourseModule
from student_profile.models import Course
from student_profile.quiz_models import Question, QuestionOption, Quiz, QuizAnswer, QuizAttempt
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


@pytest.mark.django_db
def test_question_analytics_returns_option_breakdown_and_manual_queue():
    teacher = User.objects.create_user(
        username='quiz_analytics_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_analytics_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Analytics Course', price=9100000, duration_months=5)
    module = CourseModule.objects.create(course=course, title='Analytics Module', order=1, is_published=True)

    quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Quiz Analytics Drilldown',
        quiz_type='graded',
        subject='english',
        difficulty_level='medium',
        is_published=True,
        created_by=teacher,
    )
    multiple_choice = Question.objects.create(
        quiz=quiz,
        question_type='multiple_choice',
        question_text='Choose the correct word',
        points=2,
        order=1,
    )
    correct_option = QuestionOption.objects.create(
        question=multiple_choice,
        option_text='Correct',
        is_correct=True,
        order=1,
    )
    QuestionOption.objects.create(
        question=multiple_choice,
        option_text='Incorrect',
        is_correct=False,
        order=2,
    )
    essay = Question.objects.create(
        quiz=quiz,
        question_type='essay',
        question_text='Explain your reasoning',
        points=3,
        order=2,
    )

    attempt = QuizAttempt.objects.create(
        quiz=quiz,
        student=student,
        attempt_number=1,
        status='submitted',
        total_points=Decimal('5'),
        points_earned=Decimal('2'),
        percentage_score=Decimal('40'),
        passed=False,
    )
    QuizAnswer.objects.create(
        attempt=attempt,
        question=multiple_choice,
        selected_option=correct_option,
        is_correct=True,
        points_earned=Decimal('2'),
    )
    QuizAnswer.objects.create(
        attempt=attempt,
        question=essay,
        text_answer='Student explanation',
        is_correct=False,
        points_earned=Decimal('0'),
    )

    client = _auth_client_for_user(teacher)
    response = client.get(f'/api/v1/lms/quizzes/{quiz.id}/question_analytics/')
    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data['quiz_id'] == quiz.id
    assert data['total_attempts'] == 1
    assert len(data['questions']) == 2

    question_payload = {item['question_id']: item for item in data['questions']}
    multiple_choice_payload = question_payload[multiple_choice.id]
    essay_payload = question_payload[essay.id]

    assert multiple_choice_payload['answered_count'] == 1
    assert multiple_choice_payload['accuracy_rate'] == 100.0
    assert len(multiple_choice_payload['option_breakdown']) == 1
    assert multiple_choice_payload['option_breakdown'][0]['option_text'] == 'Correct'

    assert essay_payload['pending_manual_reviews'] == 1
    assert essay_payload['manual_graded_count'] == 0
    assert essay_payload['option_breakdown'] == []


@pytest.mark.django_db
def test_grade_manually_updates_answer_and_attempt_score():
    teacher = User.objects.create_user(
        username='quiz_grading_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_grading_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Grading Course', price=9900000, duration_months=4)
    module = CourseModule.objects.create(course=course, title='Grading Module', order=1, is_published=True)

    quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Manual Grading Quiz',
        quiz_type='exam',
        subject='english',
        difficulty_level='hard',
        is_published=True,
        passing_score=70,
        created_by=teacher,
    )
    essay = Question.objects.create(
        quiz=quiz,
        question_type='essay',
        question_text='Write an advanced argument',
        points=5,
        order=1,
    )

    attempt = QuizAttempt.objects.create(
        quiz=quiz,
        student=student,
        attempt_number=1,
        status='submitted',
        total_points=Decimal('5'),
        points_earned=Decimal('0'),
        percentage_score=Decimal('0'),
        passed=False,
    )
    answer = QuizAnswer.objects.create(
        attempt=attempt,
        question=essay,
        text_answer='Long response text',
        is_correct=False,
        points_earned=Decimal('0'),
    )

    client = _auth_client_for_user(teacher)
    response = client.post(
        f'/api/v1/lms/quiz-answers/{answer.id}/grade_manually/',
        {
            'points_awarded': '4.5',
            'manual_feedback': 'Strong structure, refine evidence.',
        },
        format='json',
    )
    assert response.status_code == status.HTTP_200_OK

    answer.refresh_from_db()
    attempt.refresh_from_db()

    assert float(answer.points_earned) == 4.5
    assert answer.feedback == 'Strong structure, refine evidence.'
    assert answer.graded_by_id == teacher.id

    assert float(attempt.points_earned) == 4.5
    assert float(attempt.percentage_score) == 90.0
    assert attempt.status == 'graded'
    assert attempt.passed is True


@pytest.mark.django_db
def test_my_insights_is_scoped_to_current_student_attempts():
    teacher = User.objects.create_user(
        username='quiz_insights_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_insights_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    other_student = User.objects.create_user(
        username='quiz_insights_other',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Insights Course', price=7400000, duration_months=3)
    module = CourseModule.objects.create(course=course, title='Insights Module', order=1, is_published=True)

    english_quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='English Insight Quiz',
        quiz_type='graded',
        subject='english',
        difficulty_level='easy',
        is_published=True,
        created_by=teacher,
    )
    math_quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Math Insight Quiz',
        quiz_type='graded',
        subject='math',
        difficulty_level='hard',
        is_published=True,
        created_by=teacher,
    )

    QuizAttempt.objects.create(
        quiz=english_quiz,
        student=student,
        attempt_number=1,
        status='graded',
        total_points=Decimal('10'),
        points_earned=Decimal('8'),
        percentage_score=Decimal('80'),
        passed=True,
    )
    QuizAttempt.objects.create(
        quiz=math_quiz,
        student=student,
        attempt_number=1,
        status='graded',
        total_points=Decimal('10'),
        points_earned=Decimal('4'),
        percentage_score=Decimal('40'),
        passed=False,
    )
    # Should not be included in the requesting student's insights.
    QuizAttempt.objects.create(
        quiz=english_quiz,
        student=other_student,
        attempt_number=1,
        status='graded',
        total_points=Decimal('10'),
        points_earned=Decimal('10'),
        percentage_score=Decimal('100'),
        passed=True,
    )

    client = _auth_client_for_user(student)
    response = client.get('/api/v1/lms/quizzes/my_insights/')
    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data['total_attempts'] == 2
    assert data['quizzes_attempted'] == 2
    assert data['passed_attempts'] == 1
    assert data['average_score'] == 60.0
    assert data['pass_rate'] == 50.0
    assert data['weak_subject']['subject'] == 'math'
    assert len(data['subject_breakdown']) == 2


@pytest.mark.django_db
def test_attempt_review_payload_is_scoped_and_returns_focus_metrics():
    teacher = User.objects.create_user(
        username='quiz_review_teacher',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='quiz_review_student',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    other_student = User.objects.create_user(
        username='quiz_review_other',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    course = Course.objects.create(name='Review Course', price=6400000, duration_months=2)
    module = CourseModule.objects.create(course=course, title='Review Module', order=1, is_published=True)

    quiz = Quiz.objects.create(
        course=course,
        module=module,
        title='Review Quiz',
        quiz_type='graded',
        subject='math',
        difficulty_level='medium',
        passing_score=70,
        show_correct_answers=False,
        is_published=True,
        created_by=teacher,
    )
    question = Question.objects.create(
        quiz=quiz,
        question_type='multiple_choice',
        question_text='2 + 2 = ?',
        points=2,
        order=1,
    )
    wrong_option = QuestionOption.objects.create(
        question=question,
        option_text='3',
        is_correct=False,
        order=1,
    )
    QuestionOption.objects.create(
        question=question,
        option_text='4',
        is_correct=True,
        order=2,
    )

    attempt = QuizAttempt.objects.create(
        quiz=quiz,
        student=student,
        attempt_number=1,
        status='graded',
        total_points=Decimal('2'),
        points_earned=Decimal('0'),
        percentage_score=Decimal('0'),
        passed=False,
    )
    QuizAnswer.objects.create(
        attempt=attempt,
        question=question,
        selected_option=wrong_option,
        is_correct=False,
        points_earned=Decimal('0'),
    )

    student_client = _auth_client_for_user(student)
    student_response = student_client.get(f'/api/v1/lms/quiz-attempts/{attempt.id}/review/')
    assert student_response.status_code == status.HTTP_200_OK
    student_data = student_response.data
    assert student_data['metrics']['incorrect_questions'] == 1
    assert student_data['metrics']['accuracy_rate'] == 0.0
    assert student_data['questions'][0]['status'] == 'incorrect'
    assert student_data['questions'][0]['correct_answer'] is None

    teacher_client = _auth_client_for_user(teacher)
    teacher_response = teacher_client.get(f'/api/v1/lms/quiz-attempts/{attempt.id}/review/')
    assert teacher_response.status_code == status.HTTP_200_OK
    assert teacher_response.data['questions'][0]['correct_answer'] == '4'

    other_student_client = _auth_client_for_user(other_student)
    other_response = other_student_client.get(f'/api/v1/lms/quiz-attempts/{attempt.id}/review/')
    assert other_response.status_code == status.HTTP_404_NOT_FOUND

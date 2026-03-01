from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from users.models import User
from student_profile.content_models import CourseModule, Lesson
from student_profile.content_views import LessonViewSet
from student_profile.models import Course, ShopOrder, ShopProduct
from student_profile.quiz_models import Question, QuestionOption, Quiz, QuizAnswer, QuizAttempt
from student_profile.quiz_views import QuizAttemptViewSet
from student_profile.serializers import CourseSerializer, ShopOrderSerializer, ShopProductSerializer


class LMSModuleCompatibilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.student = User.objects.create_user(username='lms_student', password='pass1234')

        self.course = Course.objects.create(
            name='Test Course',
            price=1500000,
            duration_months=1,
        )
        self.module = CourseModule.objects.create(
            course=self.course,
            title='Module 1',
            order=1,
            is_published=True,
        )

    def _extract_results(self, response_data):
        if isinstance(response_data, dict) and 'results' in response_data:
            return response_data['results']
        return response_data

    def test_lesson_list_allows_free_preview_for_students(self):
        lesson = Lesson.objects.create(
            module=self.module,
            title='Preview Lesson',
            lesson_type='article',
            order=1,
            is_published=False,
            is_free_preview=True,
        )

        request = self.factory.get('/api/v1/lms/lessons/')
        force_authenticate(request, user=self.student)
        response = LessonViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        lessons = self._extract_results(response.data)
        lesson_ids = [item['id'] for item in lessons]
        self.assertIn(lesson.id, lesson_ids)

    def test_quiz_attempt_submit_uses_status_and_calculates_score(self):
        quiz = Quiz.objects.create(
            course=self.course,
            title='Quiz 1',
            quiz_type='practice',
            is_published=True,
            passing_score=60,
        )
        question = Question.objects.create(
            quiz=quiz,
            question_type='multiple_choice',
            question_text='2 + 2 = ?',
            points=2,
            order=1,
        )
        correct_option = QuestionOption.objects.create(
            question=question,
            option_text='4',
            is_correct=True,
            order=1,
        )

        attempt = QuizAttempt.objects.create(
            quiz=quiz,
            student=self.student,
            attempt_number=1,
            status='in_progress',
            total_points=2,
        )
        QuizAnswer.objects.create(
            attempt=attempt,
            question=question,
            selected_option=correct_option,
            is_correct=True,
            points_earned=2,
        )

        request = self.factory.post(f'/api/v1/lms/quiz-attempts/{attempt.id}/submit/', {}, format='json')
        force_authenticate(request, user=self.student)
        response = QuizAttemptViewSet.as_view({'post': 'submit'})(request, pk=attempt.id)

        self.assertEqual(response.status_code, 200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'graded')
        self.assertTrue(attempt.passed)
        self.assertEqual(float(attempt.points_earned), 2.0)
        self.assertEqual(float(attempt.percentage_score), 100.0)
        self.assertIsNotNone(attempt.submitted_at)

    def test_course_serializer_accepts_duration_weeks_and_level_aliases(self):
        serializer = CourseSerializer(data={
            'name': 'IELTS Intensive',
            'price': 2400000,
            'duration_weeks': 12,
            'level': 'Beginner',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        course = serializer.save()
        self.assertEqual(course.duration_months, 3)
        self.assertEqual(course.difficulty, 'beginner')

        data = CourseSerializer(course).data
        self.assertEqual(data['duration_weeks'], 12)
        self.assertEqual(data['level'], 'beginner')

    def test_shop_serializers_expose_frontend_expected_fields(self):
        product = ShopProduct.objects.create(
            name='Vocabulary Book',
            description='IELTS prep',
            price=75,
            quantity=3,
        )
        product_data = ShopProductSerializer(product).data
        self.assertIn('image', product_data)
        self.assertTrue(product_data['is_active'])

        order = ShopOrder.objects.create(
            student=self.student,
            product=product,
            price=75,
            quantity=2,
        )
        order_data = ShopOrderSerializer(order).data
        self.assertEqual(order_data['total_price'], 150)
        self.assertEqual(order_data['status'], 'completed')
        self.assertEqual(order_data['product_name'], 'Vocabulary Book')
        self.assertTrue(order_data['student_name'])

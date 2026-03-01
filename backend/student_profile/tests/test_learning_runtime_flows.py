from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from student_profile.content_models import CourseModule, Lesson, StudentProgress
from student_profile.content_views import CourseModuleViewSet
from student_profile.models import Course
from student_profile.sat_models import SATExam, SATAttempt
from student_profile.sat_views import SATAttemptViewSet
from users.models import User


class LearningRuntimeFlowTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.student = User.objects.create_user(username='runtime_student', password='pass1234')

    def test_course_roadmap_applies_sequential_unlocks(self):
        course = Course.objects.create(name='Roadmap Course', price=1000000, duration_months=1)
        module_one = CourseModule.objects.create(course=course, title='Module 1', order=1, is_published=True)
        module_two = CourseModule.objects.create(course=course, title='Module 2', order=2, is_published=True)
        lesson_one = Lesson.objects.create(
            module=module_one,
            title='Lesson 1',
            lesson_type='article',
            order=1,
            content='Intro',
            is_published=True,
        )
        Lesson.objects.create(
            module=module_two,
            title='Lesson 2',
            lesson_type='article',
            order=1,
            content='Next',
            is_published=True,
        )

        request = self.factory.get(f'/api/v1/lms/modules/roadmap/?course_id={course.id}')
        force_authenticate(request, user=self.student)
        response = CourseModuleViewSet.as_view({'get': 'roadmap'})(request)

        self.assertEqual(response.status_code, 200)
        modules = response.data['modules']
        self.assertFalse(modules[0]['is_locked'])
        self.assertTrue(modules[1]['is_locked'])
        self.assertEqual(response.data['continue_lesson_id'], lesson_one.id)

        StudentProgress.objects.create(
            student=self.student,
            course=course,
            module=module_one,
            lesson=lesson_one,
            completion_percentage=100,
            is_started=True,
            is_completed=True,
        )

        request = self.factory.get(f'/api/v1/lms/modules/roadmap/?course_id={course.id}')
        force_authenticate(request, user=self.student)
        response = CourseModuleViewSet.as_view({'get': 'roadmap'})(request)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['modules'][1]['is_locked'])

    def test_sat_sync_state_persists_runtime_progress(self):
        exam = SATExam.objects.create(title='SAT Runtime', description='Runtime test')
        attempt = SATAttempt.objects.create(student=self.student, exam=exam, status='in_progress')

        request = self.factory.post(
            f'/api/v1/student-profile/sat/attempts/{attempt.id}/sync_state/',
            {
                'current_module_key': 'math_module1',
                'current_question_index': 7,
                'module_time_remaining_seconds': 901,
            },
            format='json',
        )
        force_authenticate(request, user=self.student)
        response = SATAttemptViewSet.as_view({'post': 'sync_state'})(request, pk=attempt.id)

        self.assertEqual(response.status_code, 200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.current_module_key, 'math_module1')
        self.assertEqual(attempt.current_question_index, 7)
        self.assertEqual(attempt.module_time_remaining_seconds, 901)
        self.assertIsNotNone(attempt.last_state_synced_at)

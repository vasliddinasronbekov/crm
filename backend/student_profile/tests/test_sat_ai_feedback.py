from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from student_profile.sat_models import SATAnswer, SATAttempt, SATExam, SATModule, SATQuestion
from student_profile.sat_tasks import analyze_sat_performance
from users.models import User


class SATAIFeedbackTaskTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='sat_ai_student',
            password='pass1234',
        )

    def _create_attempt(self):
        exam = SATExam.objects.create(
            title='SAT AI Feedback',
            passing_score=1000,
        )
        rw_module = SATModule.objects.create(
            exam=exam,
            section='reading_writing',
            module_number=1,
            difficulty='medium',
            time_minutes=32,
        )
        math_module = SATModule.objects.create(
            exam=exam,
            section='math',
            module_number=1,
            difficulty='medium',
            time_minutes=35,
        )

        rw_weak = SATQuestion.objects.create(
            module=rw_module,
            question_number=1,
            question_text='Choose the best transition.',
            rw_type='expression_ideas',
            answer_type='mcq',
            options=['A', 'B', 'C', 'D'],
            correct_answer={'answer': 'B'},
            explanation='The second option preserves the paragraph logic.',
        )
        rw_strong = SATQuestion.objects.create(
            module=rw_module,
            question_number=2,
            question_text='Which choice is grammatically correct?',
            rw_type='standard_conventions',
            answer_type='mcq',
            options=['A', 'B', 'C', 'D'],
            correct_answer={'answer': 'C'},
            explanation='The third option avoids the comma splice.',
        )
        math_weak = SATQuestion.objects.create(
            module=math_module,
            question_number=1,
            question_text='Solve for x.',
            math_type='algebra',
            answer_type='spr',
            correct_answer={'answer': '4'},
            explanation='Rearranging the equation gives x = 4.',
        )
        math_strong = SATQuestion.objects.create(
            module=math_module,
            question_number=2,
            question_text='What is the area of the triangle?',
            math_type='geometry',
            answer_type='mcq',
            options=['12', '18', '24', '30'],
            correct_answer={'answer': 'C'},
            explanation='Area = 1/2 * base * height.',
        )

        attempt = SATAttempt.objects.create(
            student=self.student,
            exam=exam,
            status='completed',
            reading_writing_score=470,
            math_score=510,
            total_score=980,
            rw_correct=1,
            math_correct=1,
            time_taken_seconds=5400,
        )

        SATAnswer.objects.create(
            attempt=attempt,
            question=rw_weak,
            answer_given={'answer': 'A'},
            is_correct=False,
            points_earned=Decimal('0.0'),
        )
        SATAnswer.objects.create(
            attempt=attempt,
            question=rw_strong,
            answer_given={'answer': 'C'},
            is_correct=True,
            points_earned=Decimal('1.0'),
        )
        SATAnswer.objects.create(
            attempt=attempt,
            question=math_weak,
            answer_given={'answer': '9'},
            is_correct=False,
            points_earned=Decimal('0.0'),
        )
        SATAnswer.objects.create(
            attempt=attempt,
            question=math_strong,
            answer_given={'answer': 'C'},
            is_correct=True,
            points_earned=Decimal('1.0'),
        )

        return attempt

    @patch('ai.llm_service.LLMService.generate_response')
    def test_sat_feedback_is_normalized_into_structured_output(self, mock_generate_response):
        attempt = self._create_attempt()
        mock_generate_response.return_value = """
        {
          "overall_assessment": "Decent base score with clear math and revision gaps.",
          "priority_areas": ["Algebra repair"],
          "study_plan": ["Week 1-2: Algebra repair", "Week 1-2: Algebra repair"],
          "recommended_resources": ["Linear equations pack"],
          "reading_writing_feedback": {
            "strengths": ["Grammar feels steadier"],
            "weaknesses": [],
            "improvement_tips": []
          },
          "math_feedback": {
            "strengths": [],
            "weaknesses": ["Algebra accuracy drops under pressure"],
            "improvement_tips": []
          }
        }
        """

        result = analyze_sat_performance(attempt.id)

        self.assertTrue(result['success'])
        attempt.refresh_from_db()
        ai_feedback = attempt.ai_feedback

        self.assertIn('study_plan_structured', ai_feedback)
        self.assertGreaterEqual(len(ai_feedback['study_plan_structured']), 4)
        self.assertIn('recommended_resources_structured', ai_feedback)
        self.assertGreaterEqual(len(ai_feedback['recommended_resources_structured']), 3)
        self.assertIn('topic_diagnostics', ai_feedback)
        self.assertGreaterEqual(len(ai_feedback['topic_diagnostics']), 2)
        self.assertEqual(ai_feedback['topic_diagnostics'][0]['priority_rank'], 1)
        self.assertIn('performance_band', ai_feedback['topic_diagnostics'][0])
        self.assertIn('recommended_action', ai_feedback['topic_diagnostics'][0])
        self.assertEqual(
            ai_feedback['performance_data']['math']['by_type']['algebra']['label'],
            'Algebra',
        )
        self.assertIn(
            'official_time_per_question_avg_seconds',
            ai_feedback['performance_data']['time_management'],
        )
        self.assertEqual(
            ai_feedback['performance_data']['time_management']['pacing_status'],
            'slow',
        )
        self.assertGreaterEqual(len(ai_feedback['priority_areas']), 3)
        self.assertEqual(len(ai_feedback['study_plan']), len(set(ai_feedback['study_plan'])))

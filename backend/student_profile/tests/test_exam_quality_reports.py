from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from student_profile.exam_draft_models import IELTSExamDraft, IELTSQuestionDraft
from student_profile.exam_draft_views import IELTSExamDraftViewSet
from student_profile.sat_models import SATExam, SATModule, SATQuestion
from student_profile.sat_views import SATExamViewSet
from users.models import User


class ExamQualityReportTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.staff_user = User.objects.create_user(
            username="quality_admin",
            password="pass1234",
            is_staff=True,
        )

    def test_sat_quality_report_flags_duplicates(self):
        exam = SATExam.objects.create(
            title="SAT Quality",
            rw_total_questions=2,
            math_total_questions=2,
        )
        rw_module1 = SATModule.objects.create(
            exam=exam,
            section="reading_writing",
            module_number=1,
            difficulty="medium",
            time_minutes=32,
        )
        rw_module2 = SATModule.objects.create(
            exam=exam,
            section="reading_writing",
            module_number=2,
            difficulty="hard",
            time_minutes=32,
        )
        math_module1 = SATModule.objects.create(
            exam=exam,
            section="math",
            module_number=1,
            difficulty="medium",
            time_minutes=35,
        )
        math_module2 = SATModule.objects.create(
            exam=exam,
            section="math",
            module_number=2,
            difficulty="hard",
            time_minutes=35,
        )

        SATQuestion.objects.create(
            module=rw_module1,
            question_number=1,
            question_text="What is the author's main claim?",
            rw_type="craft_structure",
            answer_type="mcq",
            options=["A", "B", "C", "D"],
            correct_answer={"answer": "A"},
            explanation="Because the thesis is stated directly.",
        )
        SATQuestion.objects.create(
            module=rw_module2,
            question_number=1,
            question_text="What is the author's main claim?",
            rw_type="craft_structure",
            answer_type="mcq",
            options=["A", "B", "C", "D"],
            correct_answer={"answer": "B"},
            explanation="Duplicate prompt for detection.",
        )
        SATQuestion.objects.create(
            module=math_module1,
            question_number=1,
            question_text="Solve for x.",
            math_type="algebra",
            answer_type="spr",
            correct_answer={"answer": "4"},
            explanation="x = 4.",
        )
        SATQuestion.objects.create(
            module=math_module2,
            question_number=1,
            question_text="Find the slope.",
            math_type="geometry",
            answer_type="mcq",
            options=["1", "2", "3", "4"],
            correct_answer={"answer": "2"},
            explanation="The line rises two over one.",
        )

        request = self.factory.get(f"/api/v1/student-profile/sat/exams/{exam.id}/quality_report/")
        force_authenticate(request, user=self.staff_user)
        response = SATExamViewSet.as_view({"get": "quality_report"})(request, pk=exam.id)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["summary"]["is_publish_ready"])
        self.assertEqual(len(response.data["data_quality"]["duplicate_clusters"]), 1)
        self.assertTrue(any("duplicate" in blocker.lower() for blocker in response.data["blockers"]))

    def test_ielts_quality_report_flags_missing_audio(self):
        draft = IELTSExamDraft.objects.create(
            created_by=self.staff_user,
            section="listening",
            title="Listening Draft",
            time_limit_minutes=30,
        )
        IELTSQuestionDraft.objects.create(
            exam_draft=draft,
            question_type="multiple_choice",
            order=1,
            question_text="What time does the lecture begin?",
            options=["8:00", "8:30", "9:00", "9:30"],
            correct_answer={"answer": "9:00"},
        )

        request = self.factory.get(f"/api/v1/student-profile/exam-drafts/{draft.id}/quality_report/")
        force_authenticate(request, user=self.staff_user)
        response = IELTSExamDraftViewSet.as_view({"get": "quality_report"})(request, pk=draft.id)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["summary"]["is_content_ready"])
        self.assertEqual(response.data["data_quality"]["missing_audio"], 1)
        self.assertTrue(any("audio" in blocker.lower() for blocker in response.data["blockers"]))

"""
IELTS Exam Views
API endpoints for IELTS exam system
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal

from .ielts_models import IELTSExam, IELTSQuestion, IELTSAttempt, IELTSAnswer, IELTSSection
from .ielts_serializers import (
    IELTSExamSerializer, IELTSQuestionSerializer,
    IELTSAttemptSerializer, IELTSAnswerSerializer,
    IELTSAttemptCreateSerializer, IELTSAttemptSubmitSerializer
)


class IELTSExamViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for IELTS Exam sections
    Read-only - exams are created by admin
    """
    serializer_class = IELTSExamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get all active IELTS exams"""
        return IELTSExam.objects.filter(is_active=True)

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """
        Get all questions for an exam section
        """
        exam = self.get_object()
        questions = exam.questions.all().order_by('order')
        serializer = IELTSQuestionSerializer(
            questions,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def my_attempts(self, request, pk=None):
        """
        Get user's attempts for this exam section
        """
        exam = self.get_object()
        attempts = IELTSAttempt.objects.filter(
            student=request.user,
            exam=exam
        ).order_by('-created_at')

        serializer = IELTSAttemptSerializer(attempts, many=True)
        return Response(serializer.data)


class IELTSAttemptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for IELTS Attempts
    """
    permission_classes = [IsAuthenticated]
    queryset = IELTSAttempt.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return IELTSAttemptCreateSerializer
        return IELTSAttemptSerializer

    def get_queryset(self):
        """Get user's IELTS attempts"""
        return IELTSAttempt.objects.filter(
            student=self.request.user
        ).select_related('exam').prefetch_related('answers', 'answers__question').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """
        Submit answer for a specific question
        """
        attempt = self.get_object()

        # Check if attempt is in progress
        if attempt.status != 'in_progress':
            return Response(
                {'detail': 'This attempt is not in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if this is the user's attempt
        if attempt.student != request.user:
            return Response(
                {'detail': 'You do not have permission to submit answers for this attempt'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get question
        question_id = request.data.get('question_id')
        try:
            question = IELTSQuestion.objects.get(id=question_id, exam=attempt.exam)
        except IELTSQuestion.DoesNotExist:
            return Response(
                {'detail': 'Invalid question ID'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create or update answer
        answer, created = IELTSAnswer.objects.get_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'text_answer': request.data.get('text_answer', ''),
                'selected_option': request.data.get('selected_option', ''),
                'essay_content': request.data.get('essay_content', ''),
                'time_taken_seconds': request.data.get('time_taken_seconds', 0)
            }
        )

        if not created:
            # Update existing answer
            answer.text_answer = request.data.get('text_answer', answer.text_answer)
            answer.selected_option = request.data.get('selected_option', answer.selected_option)
            answer.essay_content = request.data.get('essay_content', answer.essay_content)
            answer.time_taken_seconds = request.data.get('time_taken_seconds', answer.time_taken_seconds)

        # Handle audio upload for Speaking section
        if 'audio_response' in request.FILES:
            answer.audio_response = request.FILES['audio_response']

        # Calculate word count for Writing section
        if question.exam.section == IELTSSection.WRITING and answer.essay_content:
            answer.word_count = len(answer.essay_content.split())

        answer.save()

        # Auto-grade Reading and Listening
        if question.exam.section in [IELTSSection.READING, IELTSSection.LISTENING]:
            answer.auto_grade()

        serializer = IELTSAnswerSerializer(answer)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit the entire attempt for evaluation
        """
        attempt = self.get_object()

        # Check if attempt is in progress
        if attempt.status != 'in_progress':
            return Response(
                {'detail': 'This attempt is not in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if this is the user's attempt
        if attempt.student != request.user:
            return Response(
                {'detail': 'You do not have permission to submit this attempt'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Mark as submitted
        attempt.status = 'submitted'
        attempt.submitted_at = timezone.now()

        # Calculate time taken
        if attempt.started_at:
            time_diff = attempt.submitted_at - attempt.started_at
            attempt.time_taken_seconds = int(time_diff.total_seconds())

        # Auto-grade Reading and Listening
        if attempt.exam.section in [IELTSSection.READING, IELTSSection.LISTENING]:
            attempt = self._auto_grade_attempt(attempt)
        else:
            # For Writing and Speaking, mark for AI evaluation
            attempt.status = 'evaluating'

        attempt.save()

        # Trigger AI evaluation for Writing and Speaking
        if attempt.exam.section in [IELTSSection.WRITING, IELTSSection.SPEAKING]:
            self._trigger_ai_evaluation(attempt)

        serializer = IELTSAttemptSerializer(attempt)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def request_refund(self, request, pk=None):
        """
        Request coin refund if band score >= passing score
        """
        attempt = self.get_object()

        # Check if this is the user's attempt
        if attempt.student != request.user:
            return Response(
                {'detail': 'You do not have permission to request refund for this attempt'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if attempt is completed
        if attempt.status != 'completed':
            return Response(
                {'detail': 'This attempt is not yet completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already refunded
        if attempt.coins_refunded > 0:
            return Response(
                {'detail': 'Refund already processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if eligible for refund
        if attempt.band_score < attempt.exam.passing_band_score:
            return Response(
                {
                    'detail': f'Band score {attempt.band_score} is below passing score {attempt.exam.passing_band_score}',
                    'band_score': float(attempt.band_score),
                    'passing_score': float(attempt.exam.passing_band_score)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process refund
        success = attempt.refund_coins()
        if success:
            serializer = IELTSAttemptSerializer(attempt)
            return Response({
                'detail': f'Refund of {attempt.coins_refunded} coins processed successfully',
                'attempt': serializer.data
            })
        else:
            return Response(
                {'detail': 'Failed to process refund'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _auto_grade_attempt(self, attempt):
        """Auto-grade Reading and Listening attempts"""
        answers = attempt.answers.all()
        total_points = Decimal('0.0')

        for answer in answers:
            answer.auto_grade()
            total_points += answer.points_earned

        attempt.raw_score = total_points
        attempt.calculate_band_score()
        attempt.status = 'completed'
        attempt.completed_at = timezone.now()

        # Auto-request refund if eligible
        if attempt.band_score >= attempt.exam.passing_band_score:
            attempt.refund_coins()

        return attempt

    def _trigger_ai_evaluation(self, attempt):
        """
        Trigger AI evaluation for Writing and Speaking sections
        This would call AI service asynchronously
        """
        from .ielts_tasks import evaluate_ielts_attempt
        evaluate_ielts_attempt.delay(attempt.id)


class IELTSAnswerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for IELTS Answers (read-only)
    """
    serializer_class = IELTSAnswerSerializer
    permission_classes = [IsAuthenticated]
    queryset = IELTSAnswer.objects.all()

    def get_queryset(self):
        """Get user's answers"""
        return IELTSAnswer.objects.filter(
            attempt__student=self.request.user
        ).select_related('attempt', 'question')

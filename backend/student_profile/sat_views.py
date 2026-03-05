"""
SAT 2025 API Views
REST API endpoints for SAT exams, attempts, and answers
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from .sat_models import (
    SATExam, SATModule, SATQuestion,
    SATAttempt, SATAnswer
)
from .sat_serializers import (
    SATExamSerializer, SATExamDetailSerializer,
    SATModuleSerializer, SATQuestionSerializer,
    SATAttemptSerializer, SATAttemptDetailSerializer,
    SATAnswerSerializer, CreateSATAttemptSerializer,
    CompleteSATAttemptSerializer
)
from .exam_quality import build_sat_exam_quality_report
from .services.coin_wallet import get_student_coin_balance


SAT_MODULE_SEQUENCE = ['rw_module1', 'rw_module2', 'math_module1', 'math_module2', 'completed']


class SATExamViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SAT exams
    Students can view published exams
    Staff can create/edit/delete exams
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Students see published exams, staff see all"""
        if self.request.user.is_staff:
            return SATExam.objects.all()
        return SATExam.objects.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SATExamDetailSerializer
        return SATExamSerializer

    @action(detail=True, methods=['get'])
    def quality_report(self, request, pk=None):
        """Admin-focused authoring quality and analytics report."""
        exam = self.get_object()
        if not request.user.is_staff:
            return Response({'detail': 'You do not have permission to view this report.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(build_sat_exam_quality_report(exam))

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """Get all questions for an exam grouped by module"""
        exam = self.get_object()
        modules = exam.modules.prefetch_related('questions').all()
        serializer = SATModuleSerializer(modules, many=True, context={'request': request})
        return Response(serializer.data)


class SATModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SAT modules
    Staff can create/edit/delete modules
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SATModuleSerializer

    def get_queryset(self):
        """Filter by exam if provided"""
        queryset = SATModule.objects.all()
        exam_id = self.request.query_params.get('exam', None)
        if exam_id:
            queryset = queryset.filter(exam_id=exam_id)
        return queryset.order_by('section', 'module_number')


class SATQuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SAT questions
    Staff can create/edit/delete questions
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SATQuestionSerializer

    def get_queryset(self):
        """Filter by module if provided"""
        queryset = SATQuestion.objects.all()
        module_id = self.request.query_params.get('module', None)
        if module_id:
            queryset = queryset.filter(module_id=module_id)
        return queryset.order_by('question_number', 'order')


class SATAttemptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SAT attempts
    Students can create attempts, submit answers, and view results
    """
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']
    queryset = SATAttempt.objects.all()

    def get_queryset(self):
        """Students can only see their own attempts"""
        return SATAttempt.objects.filter(student=self.request.user).select_related('exam').prefetch_related(
            'answers', 'answers__question', 'answers__question__module'
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SATAttemptDetailSerializer
        elif self.action == 'create':
            return CreateSATAttemptSerializer
        return SATAttemptSerializer

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        """
        Pay coins to start the exam
        Deducts 50 coins from student account
        """
        attempt = self.get_object()

        if attempt.status != 'payment_pending':
            return Response(
                {'detail': 'Payment already processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if student has enough coins
        total_coins = get_student_coin_balance(request.user)

        if total_coins < attempt.exam.coin_cost:
            return Response(
                {'detail': f'Insufficient coins. You have {total_coins}, need {attempt.exam.coin_cost}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            attempt.deduct_coins()
            return Response({
                'detail': 'Payment successful. Exam started.',
                'status': attempt.status,
                'started_at': attempt.started_at,
                'current_module_key': attempt.current_module_key,
                'current_question_index': attempt.current_question_index,
                'module_time_remaining_seconds': attempt.module_time_remaining_seconds,
            })
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """
        Submit an answer for a specific question
        """
        attempt = self.get_object()

        if attempt.status not in ['in_progress']:
            return Response(
                {'detail': 'Cannot submit answers. Attempt is not in progress.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question_id = request.data.get('question_id')
        answer_given = request.data.get('answer_given')
        time_spent = request.data.get('time_spent_seconds', 0)

        if not question_id or not answer_given:
            return Response(
                {'detail': 'question_id and answer_given are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify question belongs to this exam
        try:
            question = SATQuestion.objects.get(
                id=question_id,
                module__exam=attempt.exam
            )
        except SATQuestion.DoesNotExist:
            return Response(
                {'detail': 'Invalid question for this exam'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create or update answer
        answer, created = SATAnswer.objects.update_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'answer_given': answer_given,
                'time_spent_seconds': time_spent
            }
        )

        module_key = (
            f"rw_module{question.module.module_number}"
            if question.module.section == 'reading_writing'
            else f"math_module{question.module.module_number}"
        )
        attempt.sync_runtime_state(
            module_key=module_key,
            question_index=max(question.question_number - 1, 0),
            time_remaining_seconds=attempt.module_time_remaining_seconds,
        )

        # Grade immediately
        answer.grade_answer()

        serializer = SATAnswerSerializer(answer)
        return Response({
            'detail': 'Answer submitted' if created else 'Answer updated',
            'answer': serializer.data
        })

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Complete the SAT attempt and trigger scoring
        """
        attempt = self.get_object()

        if attempt.status != 'in_progress':
            return Response(
                {'detail': 'Attempt is not in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark as completed
        attempt.complete_attempt()

        # Calculate raw scores
        rw_answers = attempt.answers.filter(
            question__module__section='reading_writing',
            is_correct=True
        ).count()
        math_answers = attempt.answers.filter(
            question__module__section='math',
            is_correct=True
        ).count()

        attempt.rw_correct = rw_answers
        attempt.math_correct = math_answers
        attempt.save()

        # Calculate SAT scores
        attempt.calculate_scores()

        # Trigger AI feedback task (async)
        from .sat_tasks import analyze_sat_performance
        analyze_sat_performance.delay(attempt.id)

        # Auto-refund if eligible
        if attempt.refund_eligible:
            try:
                attempt.refund_coins()
            except Exception as e:
                print(f"Refund error: {e}")

        serializer = SATAttemptDetailSerializer(attempt, context={'request': request, 'show_answers': True})
        return Response({
            'detail': 'SAT attempt completed and scored',
            'attempt': serializer.data,
            'refund_applied': attempt.coins_refunded > 0
        })

    @action(detail=True, methods=['post'])
    def sync_state(self, request, pk=None):
        """Persist resumable SAT runtime state for mobile clients."""
        attempt = self.get_object()

        if attempt.status not in ['payment_pending', 'in_progress']:
            return Response(
                {'detail': 'Attempt can no longer be resumed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        module_key = request.data.get('current_module_key') or attempt.current_module_key
        if module_key not in SAT_MODULE_SEQUENCE:
            return Response(
                {'detail': 'Invalid current_module_key'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question_index = request.data.get('current_question_index', attempt.current_question_index)
        time_remaining_seconds = request.data.get(
            'module_time_remaining_seconds',
            attempt.module_time_remaining_seconds,
        )
        attempt.sync_runtime_state(
            module_key=module_key,
            question_index=question_index,
            time_remaining_seconds=time_remaining_seconds,
        )
        serializer = SATAttemptDetailSerializer(attempt, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """
        Get detailed results with correct answers and explanations
        Only available after attempt is completed
        """
        attempt = self.get_object()

        if attempt.status not in ['completed', 'evaluated']:
            return Response(
                {'detail': 'Results not available yet'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Include correct answers and explanations
        serializer = SATAttemptDetailSerializer(
            attempt,
            context={'request': request, 'show_answers': True}
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_attempts(self, request):
        """Get all attempts for current user"""
        attempts = self.get_queryset()
        serializer = SATAttemptSerializer(attempts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get SAT performance statistics for current user"""
        attempts = self.get_queryset().filter(status='evaluated')

        if not attempts.exists():
            return Response({
                'total_attempts': 0,
                'message': 'No completed attempts yet'
            })

        from django.db.models import Avg, Max, Min

        stats = attempts.aggregate(
            avg_total=Avg('total_score'),
            avg_rw=Avg('reading_writing_score'),
            avg_math=Avg('math_score'),
            best_total=Max('total_score'),
            best_rw=Max('reading_writing_score'),
            best_math=Max('math_score'),
        )

        return Response({
            'total_attempts': attempts.count(),
            'average_scores': {
                'total': round(stats['avg_total'] or 0),
                'reading_writing': round(stats['avg_rw'] or 0),
                'math': round(stats['avg_math'] or 0),
            },
            'best_scores': {
                'total': stats['best_total'] or 0,
                'reading_writing': stats['best_rw'] or 0,
                'math': stats['best_math'] or 0,
            },
            'attempts': SATAttemptSerializer(attempts, many=True).data
        })


class SATAnswerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for SAT answers
    Students can view their own answers
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SATAnswerSerializer
    queryset = SATAnswer.objects.all()

    def get_queryset(self):
        """Students can only see their own answers"""
        return SATAnswer.objects.filter(
            attempt__student=self.request.user
        ).select_related('question', 'attempt')

"""
Quiz & Assignment System API Views
"""

from decimal import Decimal, InvalidOperation

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Avg, Count, Sum, Q, F, Max

from .quiz_models import (
    Assignment, AssignmentSubmission,
    Quiz, Question, QuestionOption,
    QuizAttempt, QuizAnswer
)
from .quiz_serializers import (
    AssignmentSerializer,
    AssignmentSubmissionSerializer,
    AssignmentSubmissionCreateSerializer,
    AssignmentSubmissionGradeSerializer,
    QuizSerializer,
    QuestionSerializer,
    QuestionCreateSerializer,
    QuizAttemptSerializer,
    QuizAttemptCreateSerializer,
    QuizAnswerSerializer,
    QuizAnswerSubmitSerializer
)
from users.models import User


class AssignmentViewSet(viewsets.ModelViewSet):
    """Assignment management API"""

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter assignments"""
        queryset = Assignment.objects.select_related('module')

        # Filter by module
        module_id = self.request.query_params.get('module_id')
        if module_id:
            queryset = queryset.filter(module_id=module_id)

        # Filter by assignment type
        assignment_type = self.request.query_params.get('assignment_type')
        if assignment_type:
            queryset = queryset.filter(assignment_type=assignment_type)

        # Students only see published assignments
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_published=True)

        return queryset.order_by('due_date')

    def get_permissions(self):
        """Allow students to read, staff to write"""
        if self.action in ['list', 'retrieve', 'submit']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    @action(detail=True, methods=['get'])
    def submissions(self, request, pk=None):
        """Get all submissions for this assignment"""
        assignment = self.get_object()

        submissions = AssignmentSubmission.objects.filter(
            assignment=assignment
        ).select_related('student', 'graded_by')

        # Filter by status
        submission_status = request.query_params.get('status')
        if submission_status:
            submissions = submissions.filter(status=submission_status)

        # Filter by student
        student_id = request.query_params.get('student_id')
        if student_id:
            submissions = submissions.filter(student_id=student_id)

        submissions = submissions.order_by('-submitted_at')
        serializer = AssignmentSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit assignment (student action)"""
        assignment = self.get_object()

        # Check if already submitted and assignment doesn't allow resubmission
        existing_submission = AssignmentSubmission.objects.filter(
            assignment=assignment,
            student=request.user
        ).first()

        # For now, allow multiple attempts (controlled by frontend)

        serializer = AssignmentSubmissionCreateSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            submission = serializer.save()
            response_serializer = AssignmentSubmissionSerializer(submission)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get assignment statistics"""
        assignment = self.get_object()

        submissions = AssignmentSubmission.objects.filter(assignment=assignment)

        total_submissions = submissions.count()
        graded_submissions = submissions.filter(graded_at__isnull=False).count()
        pending_submissions = submissions.filter(status='submitted').count()
        late_submissions = submissions.filter(is_late=True).count()

        avg_score = submissions.filter(
            graded_at__isnull=False
        ).aggregate(avg=Avg('points_earned'))['avg'] or 0

        return Response({
            'assignment_id': assignment.id,
            'total_submissions': total_submissions,
            'graded_submissions': graded_submissions,
            'pending_submissions': pending_submissions,
            'late_submissions': late_submissions,
            'average_score': round(avg_score, 2),
            'max_points': assignment.max_points
        })


class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    """Assignment submission management API"""

    queryset = AssignmentSubmission.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return AssignmentSubmissionCreateSerializer
        elif self.action in ['grade', 'partial_update']:
            return AssignmentSubmissionGradeSerializer
        return AssignmentSubmissionSerializer

    def get_queryset(self):
        """Filter submissions"""
        queryset = AssignmentSubmission.objects.select_related(
            'assignment', 'student', 'graded_by'
        )

        user = self.request.user

        # Students see only their own submissions
        if not user.is_staff:
            queryset = queryset.filter(student=user)
        else:
            # Staff can filter by student
            student_id = self.request.query_params.get('student_id')
            if student_id:
                queryset = queryset.filter(student_id=student_id)

        # Filter by assignment
        assignment_id = self.request.query_params.get('assignment_id')
        if assignment_id:
            queryset = queryset.filter(assignment_id=assignment_id)

        # Filter by status
        submission_status = self.request.query_params.get('status')
        if submission_status:
            queryset = queryset.filter(status=submission_status)

        return queryset.order_by('-submitted_at')

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def grade(self, request, pk=None):
        """Grade a submission (teacher action)"""
        submission = self.get_object()

        serializer = AssignmentSubmissionGradeSerializer(
            submission,
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()
            response_serializer = AssignmentSubmissionSerializer(submission)
            return Response(response_serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def my_submissions(self, request):
        """Get current user's submissions"""
        submissions = AssignmentSubmission.objects.filter(
            student=request.user
        ).select_related('assignment').order_by('-submitted_at')

        serializer = AssignmentSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)


class QuizViewSet(viewsets.ModelViewSet):
    """Quiz management API"""

    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter quizzes"""
        queryset = Quiz.objects.select_related('module')

        # Filter by module
        module_id = self.request.query_params.get('module_id')
        if module_id:
            queryset = queryset.filter(module_id=module_id)

        # Filter by quiz type
        quiz_type = self.request.query_params.get('quiz_type')
        if quiz_type:
            queryset = queryset.filter(quiz_type=quiz_type)

        # Students only see published quizzes
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_published=True)

        return queryset.order_by('created_at')

    def get_permissions(self):
        """Allow students to read and take, staff to write"""
        if self.action in ['list', 'retrieve', 'start_attempt', 'questions']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """Get quiz questions (shuffled if enabled)"""
        quiz = self.get_object()
        questions = quiz.questions.prefetch_related('options').order_by('order')

        # Shuffle if enabled
        if quiz.shuffle_questions:
            questions = questions.order_by('?')

        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start_attempt(self, request, pk=None):
        """Start a new quiz attempt"""
        quiz = self.get_object()

        serializer = QuizAttemptCreateSerializer(
            data={'quiz': quiz.id},
            context={'request': request}
        )

        if serializer.is_valid():
            attempt = serializer.save()
            response_serializer = QuizAttemptSerializer(attempt)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get quiz statistics"""
        quiz = self.get_object()

        attempts = QuizAttempt.objects.filter(quiz=quiz, status__in=['submitted', 'graded'])

        total_attempts = attempts.count()
        unique_takers = attempts.values('student').distinct().count()
        passed_attempts = attempts.filter(passed=True).count()
        avg_score = attempts.aggregate(avg=Avg('percentage_score'))['avg'] or 0
        avg_time = attempts.aggregate(avg=Avg('time_taken_seconds'))['avg'] or 0

        return Response({
            'quiz_id': quiz.id,
            'total_attempts': total_attempts,
            'unique_takers': unique_takers,
            'passed_attempts': passed_attempts,
            'pass_rate': round((passed_attempts / total_attempts * 100), 2) if total_attempts > 0 else 0,
            'average_score_percentage': round(avg_score, 2),
            'average_time_seconds': round(avg_time, 2),
            'average_time_minutes': round(avg_time / 60, 2)
        })

    @action(detail=True, methods=['get'])
    def leaderboard(self, request, pk=None):
        """Get quiz leaderboard (top scores)"""
        quiz = self.get_object()

        # Get best attempt per student
        best_attempts = QuizAttempt.objects.filter(
            quiz=quiz,
            status__in=['submitted', 'graded']
        ).values('student').annotate(
            best_score=Max('percentage_score'),
            best_attempt_id=Max('id')
        ).order_by('-best_score')[:10]

        leaderboard = []
        for item in best_attempts:
            attempt = QuizAttempt.objects.get(id=item['best_attempt_id'])
            leaderboard.append({
                'student_id': attempt.student.id,
                'student_name': attempt.student.get_full_name(),
                'score': float(attempt.percentage_score),
                'submitted_at': attempt.submitted_at
            })

        return Response(leaderboard)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def create_with_questions(self, request):
        """Create quiz with questions and options in one call"""
        quiz_data = request.data.copy()
        questions_data = quiz_data.pop('questions', [])

        # Create quiz
        quiz_serializer = QuizSerializer(data=quiz_data, context={'request': request})
        if not quiz_serializer.is_valid():
            return Response(quiz_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        quiz = quiz_serializer.save(created_by=request.user)

        # Create questions with options
        created_questions = []
        for idx, question_data in enumerate(questions_data, start=1):
            question_data['quiz'] = quiz.id
            question_data['order'] = question_data.get('order', idx)

            question_serializer = QuestionCreateSerializer(data=question_data)
            if question_serializer.is_valid():
                question = question_serializer.save()
                created_questions.append(question)
            else:
                # Rollback: delete quiz and questions created so far
                quiz.delete()
                return Response({
                    'error': f'Invalid question data at index {idx-1}',
                    'details': question_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

        # Return complete quiz data
        response_serializer = QuizSerializer(quiz, context={'request': request})
        return Response({
            'quiz': response_serializer.data,
            'questions_created': len(created_questions),
            'message': f'Quiz created successfully with {len(created_questions)} questions'
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def duplicate(self, request, pk=None):
        """Duplicate an existing quiz with all questions"""
        original_quiz = self.get_object()

        # Create copy of quiz
        new_quiz = Quiz.objects.create(
            course=original_quiz.course,
            module=original_quiz.module,
            lesson=original_quiz.lesson,
            title=f"{original_quiz.title} (Copy)",
            description=original_quiz.description,
            quiz_type=original_quiz.quiz_type,
            time_limit_minutes=original_quiz.time_limit_minutes,
            passing_score=original_quiz.passing_score,
            show_correct_answers=original_quiz.show_correct_answers,
            shuffle_questions=original_quiz.shuffle_questions,
            shuffle_answers=original_quiz.shuffle_answers,
            max_attempts=original_quiz.max_attempts,
            allow_review=original_quiz.allow_review,
            is_published=False,  # Keep draft until reviewed
            created_by=request.user
        )

        # Duplicate all questions and their options
        for question in original_quiz.questions.all():
            new_question = Question.objects.create(
                quiz=new_quiz,
                question_type=question.question_type,
                question_text=question.question_text,
                explanation=question.explanation,
                points=question.points,
                order=question.order,
                is_required=question.is_required
            )

            # Duplicate options
            for option in question.options.all():
                QuestionOption.objects.create(
                    question=new_question,
                    option_text=option.option_text,
                    is_correct=option.is_correct,
                    order=option.order
                )

        serializer = QuizSerializer(new_quiz, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuestionViewSet(viewsets.ModelViewSet):
    """Question management API (for quiz builder)"""

    queryset = Question.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        """Use different serializers for create/update"""
        if self.action in ['create', 'update', 'partial_update']:
            return QuestionCreateSerializer
        return QuestionSerializer

    def get_queryset(self):
        """Filter questions"""
        queryset = Question.objects.prefetch_related('options')

        # Filter by quiz
        quiz_id = self.request.query_params.get('quiz_id')
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)

        return queryset.order_by('order')

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Reorder questions in a quiz"""
        question_orders = request.data.get('question_orders', [])

        for item in question_orders:
            question = Question.objects.get(id=item['id'])
            question.order = item['order']
            question.save(update_fields=['order'])

        return Response({'message': 'Questions reordered successfully'})

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a question"""
        question = self.get_object()

        # Create duplicate
        new_question = Question.objects.create(
            quiz=question.quiz,
            question_type=question.question_type,
            question_text=f"{question.question_text} (Copy)",
            explanation=question.explanation,
            points=question.points,
            order=question.order + 1,
            is_required=question.is_required,
        )

        # Duplicate options
        for option in question.options.all():
            QuestionOption.objects.create(
                question=new_question,
                option_text=option.option_text,
                is_correct=option.is_correct,
                order=option.order
            )

        serializer = QuestionSerializer(new_question)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuizAttemptViewSet(viewsets.ModelViewSet):
    """Quiz attempt management API"""

    queryset = QuizAttempt.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return QuizAttemptCreateSerializer
        return QuizAttemptSerializer

    def get_queryset(self):
        """Filter attempts"""
        queryset = QuizAttempt.objects.select_related('quiz', 'student')

        user = self.request.user

        # Students see only their own attempts
        if not user.is_staff:
            queryset = queryset.filter(student=user)
        else:
            # Staff can filter by student
            student_id = self.request.query_params.get('student_id')
            if student_id:
                queryset = queryset.filter(student_id=student_id)

        # Filter by quiz
        quiz_id = self.request.query_params.get('quiz_id')
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)

        # Filter by status
        attempt_status = self.request.query_params.get('status')
        if attempt_status:
            queryset = queryset.filter(status=attempt_status)

        # Backward-compatible submitted filter
        is_submitted = self.request.query_params.get('is_submitted')
        if is_submitted is not None:
            if is_submitted.lower() == 'true':
                queryset = queryset.filter(status__in=['submitted', 'graded'])
            else:
                queryset = queryset.filter(status='in_progress')

        return queryset.order_by('-started_at')

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit quiz attempt (finalize and calculate score)"""
        attempt = self.get_object()

        if attempt.student != request.user:
            return Response(
                {'error': 'You can only submit your own attempts'},
                status=status.HTTP_403_FORBIDDEN
            )

        if attempt.status != 'in_progress':
            return Response(
                {'error': 'This attempt has already been submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate time taken
        time_taken = (timezone.now() - attempt.started_at).total_seconds()

        # Mark submitted, then auto-calculate/grade objective questions.
        attempt.submitted_at = timezone.now()
        attempt.time_taken_seconds = int(time_taken)
        attempt.status = 'submitted'
        attempt.save(update_fields=['submitted_at', 'time_taken_seconds', 'status', 'updated_at'])

        attempt.calculate_score()

        serializer = QuizAttemptSerializer(attempt)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_attempts(self, request):
        """Get current user's quiz attempts"""
        quiz_id = request.query_params.get('quiz_id')

        attempts = QuizAttempt.objects.filter(student=request.user)

        if quiz_id:
            attempts = attempts.filter(quiz_id=quiz_id)

        attempts = attempts.order_by('-started_at')
        serializer = QuizAttemptSerializer(attempts, many=True)
        return Response(serializer.data)


class QuizAnswerViewSet(viewsets.ModelViewSet):
    """Quiz answer management API"""

    queryset = QuizAnswer.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return QuizAnswerSubmitSerializer
        return QuizAnswerSerializer

    def get_queryset(self):
        """Filter answers"""
        queryset = QuizAnswer.objects.select_related('attempt', 'question', 'selected_option')

        user = self.request.user

        # Students see only their own answers
        if not user.is_staff:
            queryset = queryset.filter(attempt__student=user)

        # Filter by attempt
        attempt_id = self.request.query_params.get('attempt_id')
        if attempt_id:
            queryset = queryset.filter(attempt_id=attempt_id)

        return queryset.order_by('question__order')

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def grade_manually(self, request, pk=None):
        """Manually grade essay/short answer questions"""
        answer = self.get_object()

        if answer.question.question_type not in ['essay', 'short_answer']:
            return Response(
                {'error': 'Only essay and short answer questions can be manually graded'},
                status=status.HTTP_400_BAD_REQUEST
            )

        points_awarded = request.data.get('points_awarded')
        manual_feedback = request.data.get('manual_feedback', '')

        if points_awarded is None:
            return Response(
                {'error': 'points_awarded is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_points = Decimal(str(points_awarded))
        except (InvalidOperation, ValueError):
            return Response(
                {'error': 'points_awarded must be a valid number'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if parsed_points < 0 or parsed_points > answer.question.points:
            return Response(
                {'error': f'points_awarded must be between 0 and {answer.question.points}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        answer.points_earned = parsed_points
        answer.is_correct = parsed_points > 0
        answer.feedback = manual_feedback
        answer.graded_by = request.user
        answer.save(update_fields=['points_earned', 'is_correct', 'feedback', 'graded_by'])

        # Recalculate attempt score
        attempt = answer.attempt
        attempt.calculate_score()

        serializer = QuizAnswerSerializer(answer)
        return Response(serializer.data)

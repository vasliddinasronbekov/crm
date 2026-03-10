"""
Quiz & Assignment System API Views
"""

from decimal import Decimal, InvalidOperation

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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
from users.permissions import HasRoleCapability
from users.roles import has_capability


class AssignmentViewSet(viewsets.ModelViewSet):
    """Assignment management API"""

    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'assignments.view',
        'retrieve': 'assignments.view',
        'submit': 'assignments.view',
        'submissions': 'assignments.edit',
        'statistics': 'assignments.edit',
        'create': 'assignments.create',
        'update': 'assignments.edit',
        'partial_update': 'assignments.edit',
        'destroy': 'assignments.delete',
    }

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
        if not has_capability(self.request.user, 'assignments.edit'):
            queryset = queryset.filter(is_published=True)

        return queryset.order_by('due_date')

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

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
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'assignments.view',
        'retrieve': 'assignments.view',
        'create': 'assignments.view',
        'my_submissions': 'assignments.view',
        'grade': 'assignments.edit',
        'update': 'assignments.edit',
        'partial_update': 'assignments.edit',
        'destroy': 'assignments.delete',
    }

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
        if not has_capability(user, 'assignments.edit'):
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

    @action(detail=True, methods=['post'])
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
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'quizzes.view',
        'retrieve': 'quizzes.view',
        'questions': 'quizzes.view',
        'start_attempt': 'quizzes.view',
        'statistics': 'quizzes.view',
        'leaderboard': 'quizzes.view',
        'question_analytics': 'quizzes.view',
        'my_insights': 'quizzes.view',
        'dashboard_summary': 'quizzes.view',
        'create': 'quizzes.create',
        'create_with_questions': 'quizzes.create',
        'duplicate': 'quizzes.create',
        'update': 'quizzes.edit',
        'partial_update': 'quizzes.edit',
        'destroy': 'quizzes.delete',
    }

    def _apply_quiz_filters(self, queryset):
        # Filter by module
        module_id = self.request.query_params.get('module_id')
        if module_id:
            queryset = queryset.filter(module_id=module_id)

        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        # Filter by quiz type
        quiz_type = self.request.query_params.get('quiz_type')
        if quiz_type:
            queryset = queryset.filter(quiz_type=quiz_type)

        # Filter by subject
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subject=subject)

        # Filter by difficulty
        difficulty_level = self.request.query_params.get('difficulty_level')
        if difficulty_level:
            queryset = queryset.filter(difficulty_level=difficulty_level)

        # Filter by published status
        is_published = self.request.query_params.get('is_published')
        if is_published is not None:
            queryset = queryset.filter(is_published=is_published.lower() == 'true')

        # Search title/description/course
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(course__name__icontains=search)
            )

        return queryset

    def get_queryset(self):
        """Filter quizzes"""
        queryset = Quiz.objects.select_related('course', 'module', 'lesson', 'created_by')
        queryset = self._apply_quiz_filters(queryset)

        # Students only see published quizzes
        if not has_capability(self.request.user, 'quizzes.edit'):
            queryset = queryset.filter(is_published=True)

        queryset = queryset.annotate(
            attempts_total=Count(
                'attempts',
                filter=Q(attempts__status__in=['submitted', 'graded']),
                distinct=True,
            ),
            attempts_passed=Count(
                'attempts',
                filter=Q(attempts__status__in=['submitted', 'graded'], attempts__passed=True),
                distinct=True,
            ),
            average_score=Avg(
                'attempts__percentage_score',
                filter=Q(attempts__status__in=['submitted', 'graded']),
            ),
            last_attempt_at=Max(
                'attempts__submitted_at',
                filter=Q(attempts__status__in=['submitted', 'graded']),
            ),
        )

        return queryset.order_by('-created_at')

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """Get quiz questions (shuffled if enabled)"""
        quiz = self.get_object()
        questions = quiz.questions.prefetch_related('options').order_by('order')

        # Shuffle if enabled
        if quiz.shuffle_questions:
            questions = questions.order_by('?')

        serializer = QuestionSerializer(questions, many=True, context={'request': request})
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

    @action(detail=True, methods=['get'])
    def question_analytics(self, request, pk=None):
        """Per-question analytics drilldown for staff quiz review."""
        quiz = self.get_object()
        attempts = QuizAttempt.objects.filter(
            quiz=quiz,
            status__in=['submitted', 'graded'],
        )
        total_attempts = attempts.count()

        answers = QuizAnswer.objects.filter(
            attempt_id__in=attempts.values('id'),
        ).select_related('selected_option')

        payload = []
        for question in quiz.questions.prefetch_related('options').order_by('order'):
            question_answers = answers.filter(question=question)
            answered_count = question_answers.count()
            correct_count = question_answers.filter(is_correct=True).count()
            average_points = question_answers.aggregate(value=Avg('points_earned'))['value'] or 0

            option_breakdown = []
            pending_manual_reviews = 0
            manual_graded_count = 0
            if question.question_type in ['essay', 'short_answer']:
                pending_manual_reviews = question_answers.filter(graded_by__isnull=True).count()
                manual_graded_count = question_answers.exclude(graded_by__isnull=True).count()
            else:
                option_breakdown = [
                    {
                        'option_id': row['selected_option_id'],
                        'option_text': row['selected_option__option_text'] or 'No answer',
                        'count': row['count'],
                    }
                    for row in question_answers.values(
                        'selected_option_id',
                        'selected_option__option_text',
                    ).annotate(count=Count('id')).order_by('-count')
                ]

            payload.append({
                'question_id': question.id,
                'order': question.order,
                'question_text': question.question_text,
                'question_type': question.question_type,
                'question_type_display': question.get_question_type_display(),
                'points': question.points,
                'answered_count': answered_count,
                'correct_count': correct_count,
                'submission_rate': round((answered_count / total_attempts) * 100, 2) if total_attempts else 0,
                'accuracy_rate': round((correct_count / answered_count) * 100, 2) if answered_count else 0,
                'average_points': round(float(average_points), 2) if answered_count else 0,
                'pending_manual_reviews': pending_manual_reviews,
                'manual_graded_count': manual_graded_count,
                'option_breakdown': option_breakdown,
            })

        return Response({
            'quiz_id': quiz.id,
            'total_attempts': total_attempts,
            'questions': payload,
        })

    @action(detail=False, methods=['get'])
    def my_insights(self, request):
        """Student-focused quiz insights based only on the current user's attempts."""
        attempts = QuizAttempt.objects.filter(
            student=request.user,
            status__in=['submitted', 'graded'],
        ).select_related('quiz')

        total_attempts = attempts.count()
        quizzes_attempted = attempts.values('quiz_id').distinct().count()
        passed_attempts = attempts.filter(passed=True).count()
        average_score = attempts.aggregate(value=Avg('percentage_score'))['value'] or 0

        subject_breakdown_rows = attempts.values('quiz__subject').annotate(
            attempts=Count('id'),
            average_score=Avg('percentage_score'),
            passed_attempts=Count('id', filter=Q(passed=True)),
        ).order_by('-attempts')

        subject_breakdown = []
        weak_subject = None
        for row in subject_breakdown_rows:
            average_for_subject = float(row['average_score'] or 0)
            attempts_for_subject = row['attempts'] or 0
            pass_rate_for_subject = (
                (float(row['passed_attempts'] or 0) / float(attempts_for_subject)) * 100
                if attempts_for_subject
                else 0
            )
            subject_payload = {
                'subject': row['quiz__subject'] or 'general',
                'attempts': attempts_for_subject,
                'average_score': round(average_for_subject, 2),
                'pass_rate': round(pass_rate_for_subject, 2),
            }
            subject_breakdown.append(subject_payload)
            if weak_subject is None or subject_payload['average_score'] < weak_subject['average_score']:
                weak_subject = subject_payload

        recent_attempts = [
            {
                'attempt_id': attempt.id,
                'quiz_id': attempt.quiz_id,
                'quiz_title': attempt.quiz.title,
                'subject': attempt.quiz.subject,
                'difficulty_level': attempt.quiz.difficulty_level,
                'score': round(float(attempt.percentage_score or 0), 2),
                'passed': bool(attempt.passed),
                'submitted_at': attempt.submitted_at,
            }
            for attempt in attempts.order_by('-submitted_at', '-id')[:8]
        ]

        return Response({
            'total_attempts': total_attempts,
            'quizzes_attempted': quizzes_attempted,
            'passed_attempts': passed_attempts,
            'pass_rate': round((float(passed_attempts) / float(total_attempts)) * 100, 2) if total_attempts else 0,
            'average_score': round(float(average_score), 2),
            'subject_breakdown': subject_breakdown,
            'weak_subject': weak_subject,
            'recent_attempts': recent_attempts,
        })

    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        """Aggregated quiz metrics for dashboard/operations UI."""
        queryset = self._apply_quiz_filters(Quiz.objects.all())

        if not has_capability(request.user, 'quizzes.edit'):
            queryset = queryset.filter(is_published=True)

        total_quizzes = queryset.count()
        published_quizzes = queryset.filter(is_published=True).count()
        draft_quizzes = total_quizzes - published_quizzes

        attempts_qs = QuizAttempt.objects.filter(
            quiz_id__in=queryset.values('id'),
            status__in=['submitted', 'graded'],
        )

        attempts_total = attempts_qs.count()
        attempts_passed = attempts_qs.filter(passed=True).count()
        avg_score = attempts_qs.aggregate(value=Avg('percentage_score'))['value'] or 0

        by_subject = queryset.values('subject').annotate(count=Count('id')).order_by('-count')
        by_difficulty = queryset.values('difficulty_level').annotate(count=Count('id')).order_by('-count')
        by_type = queryset.values('quiz_type').annotate(count=Count('id')).order_by('-count')

        top_quizzes = queryset.annotate(
            question_count=Count('questions', distinct=True),
            attempts_total=Count(
                'attempts',
                filter=Q(attempts__status__in=['submitted', 'graded']),
                distinct=True,
            ),
            avg_score=Avg(
                'attempts__percentage_score',
                filter=Q(attempts__status__in=['submitted', 'graded']),
            ),
        ).order_by('-attempts_total', 'title')[:5]

        top_quizzes_payload = [
            {
                'id': quiz.id,
                'title': quiz.title,
                'quiz_type': quiz.quiz_type,
                'subject': quiz.subject,
                'difficulty_level': quiz.difficulty_level,
                'is_published': quiz.is_published,
                'question_count': quiz.question_count or 0,
                'attempts_total': quiz.attempts_total or 0,
                'avg_score': round(float(quiz.avg_score or 0), 2),
            }
            for quiz in top_quizzes
        ]

        return Response({
            'total_quizzes': total_quizzes,
            'published_quizzes': published_quizzes,
            'draft_quizzes': draft_quizzes,
            'attempts_total': attempts_total,
            'pass_rate': round((attempts_passed / attempts_total) * 100, 2) if attempts_total else 0,
            'average_score': round(float(avg_score), 2),
            'by_subject': list(by_subject),
            'by_difficulty': list(by_difficulty),
            'by_type': list(by_type),
            'top_quizzes': top_quizzes_payload,
        })

    @action(detail=False, methods=['post'])
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

    @action(detail=True, methods=['post'])
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
            subject=original_quiz.subject,
            difficulty_level=original_quiz.difficulty_level,
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
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'quizzes.view',
        'retrieve': 'quizzes.view',
        'create': 'quizzes.create',
        'duplicate': 'quizzes.edit',
        'update': 'quizzes.edit',
        'partial_update': 'quizzes.edit',
        'reorder': 'quizzes.edit',
        'destroy': 'quizzes.delete',
    }

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

        if not has_capability(self.request.user, 'quizzes.edit'):
            queryset = queryset.filter(quiz__is_published=True)

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
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'quizzes.view',
        'retrieve': 'quizzes.view',
        'create': 'quizzes.view',
        'submit': 'quizzes.view',
        'review': 'quizzes.view',
        'my_attempts': 'quizzes.view',
        'update': 'quizzes.edit',
        'partial_update': 'quizzes.edit',
        'destroy': 'quizzes.delete',
    }

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return QuizAttemptCreateSerializer
        return QuizAttemptSerializer

    def get_permissions(self):
        return [IsAuthenticated(), HasRoleCapability()]

    def get_queryset(self):
        """Filter attempts"""
        queryset = QuizAttempt.objects.select_related('quiz', 'student')

        user = self.request.user

        # Students see only their own attempts
        if not has_capability(user, 'quizzes.edit'):
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

    @action(detail=True, methods=['get'])
    def review(self, request, pk=None):
        """Detailed per-question review payload for mobile student UX."""
        attempt = self.get_object()
        quiz = attempt.quiz
        can_view_answer_key = has_capability(request.user, 'quizzes.edit') or quiz.show_correct_answers

        answers_by_question = {
            answer.question_id: answer
            for answer in attempt.answers.select_related('question', 'selected_option', 'graded_by')
        }
        questions = quiz.questions.prefetch_related('options').order_by('order')

        question_reviews = []
        answered_count = 0
        correct_count = 0
        incorrect_count = 0
        pending_manual_count = 0
        unanswered_count = 0
        points_earned_total = Decimal('0')
        tips = []

        for question in questions:
            answer = answers_by_question.get(question.id)
            selected_answer_text = None
            if answer:
                selected_answer_text = (
                    answer.selected_option.option_text
                    if answer.selected_option_id
                    else answer.text_answer or None
                )

            correct_answer_text = None
            if can_view_answer_key:
                if question.question_type in ['multiple_choice', 'true_false']:
                    correct_option = question.options.filter(is_correct=True).first()
                    correct_answer_text = correct_option.option_text if correct_option else None
                else:
                    correct_answer_text = question.explanation or None

            question_status = 'unanswered'
            reason = 'Unanswered'
            if answer:
                answered_count += 1
                points_earned_total += answer.points_earned or 0
                pending_manual = (
                    question.question_type in ['essay', 'short_answer']
                    and answer.graded_by_id is None
                )
                if pending_manual:
                    question_status = 'pending_manual'
                    pending_manual_count += 1
                    reason = 'Awaiting teacher grading'
                elif answer.is_correct:
                    question_status = 'correct'
                    correct_count += 1
                    reason = 'Correct answer'
                else:
                    question_status = 'incorrect'
                    incorrect_count += 1
                    reason = 'Incorrect answer'
            else:
                unanswered_count += 1

            question_reviews.append({
                'question_id': question.id,
                'order': question.order,
                'question_text': question.question_text,
                'question_type': question.question_type,
                'question_type_display': question.get_question_type_display(),
                'points': question.points,
                'points_earned': float(answer.points_earned) if answer else 0,
                'selected_answer': selected_answer_text,
                'correct_answer': correct_answer_text,
                'feedback': answer.feedback if answer else '',
                'status': question_status,
                'status_reason': reason,
                'needs_focus': question_status in ['incorrect', 'pending_manual', 'unanswered'],
                'explanation': question.explanation or None,
            })

        total_questions = questions.count()
        resolved_answers = max(answered_count - pending_manual_count, 0)
        accuracy_rate = (
            round((float(correct_count) / float(resolved_answers)) * 100, 2)
            if resolved_answers
            else 0
        )
        completion_rate = (
            round((float(answered_count) / float(total_questions)) * 100, 2)
            if total_questions
            else 0
        )

        if pending_manual_count > 0:
            tips.append('Some written answers are waiting for teacher grading.')
        if incorrect_count > 0:
            tips.append('Review incorrect questions and explanations before your next attempt.')
        if unanswered_count > 0:
            tips.append('Try to answer every question to maximize your score.')
        if not tips:
            tips.append('Strong work. Keep practicing to improve speed and consistency.')

        focus_questions = [
            {
                'question_id': review['question_id'],
                'order': review['order'],
                'status': review['status'],
                'reason': review['status_reason'],
            }
            for review in question_reviews
            if review['needs_focus']
        ][:5]

        return Response({
            'attempt': {
                'id': attempt.id,
                'status': attempt.status,
                'attempt_number': attempt.attempt_number,
                'started_at': attempt.started_at,
                'submitted_at': attempt.submitted_at,
                'time_taken_seconds': attempt.time_taken_seconds,
                'percentage_score': float(attempt.percentage_score),
                'points_earned': float(attempt.points_earned),
                'total_points': float(attempt.total_points),
                'passed': attempt.passed,
            },
            'quiz': {
                'id': quiz.id,
                'title': quiz.title,
                'subject': quiz.subject,
                'subject_display': quiz.get_subject_display(),
                'difficulty_level': quiz.difficulty_level,
                'difficulty_level_display': quiz.get_difficulty_level_display(),
                'passing_score': quiz.passing_score,
                'show_correct_answers': quiz.show_correct_answers,
            },
            'metrics': {
                'total_questions': total_questions,
                'answered_questions': answered_count,
                'correct_questions': correct_count,
                'incorrect_questions': incorrect_count,
                'pending_manual_questions': pending_manual_count,
                'unanswered_questions': unanswered_count,
                'accuracy_rate': accuracy_rate,
                'completion_rate': completion_rate,
                'points_earned': round(float(points_earned_total), 2),
                'points_available': round(float(quiz.total_points), 2),
            },
            'focus_questions': focus_questions,
            'tips': tips,
            'questions': question_reviews,
        })

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
    permission_classes = [IsAuthenticated, HasRoleCapability]
    action_capabilities = {
        'list': 'quizzes.view',
        'retrieve': 'quizzes.view',
        'create': 'quizzes.view',
        'grade_manually': 'quizzes.edit',
        'update': 'quizzes.edit',
        'partial_update': 'quizzes.edit',
        'destroy': 'quizzes.delete',
    }

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
        if not has_capability(user, 'quizzes.edit'):
            queryset = queryset.filter(attempt__student=user)

        # Filter by attempt
        attempt_id = self.request.query_params.get('attempt_id')
        if attempt_id:
            queryset = queryset.filter(attempt_id=attempt_id)

        return queryset.order_by('question__order')

    @action(detail=True, methods=['post'])
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

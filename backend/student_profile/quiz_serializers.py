"""
Quiz & Assignment System Serializers
"""
from typing import Any

from rest_framework import serializers
from django.utils import timezone
from .quiz_models import (
    Assignment, AssignmentSubmission,
    Quiz, Question, QuestionOption,
    QuizAttempt, QuizAnswer
)
from users.serializers import UserSerializer


class AssignmentSerializer(serializers.ModelSerializer):
    """Assignment serializer"""
    module_title = serializers.CharField(source='module.title', read_only=True)
    assignment_type_display = serializers.CharField(source='get_assignment_type_display', read_only=True)
    total_submissions = serializers.SerializerMethodField()
    graded_submissions = serializers.SerializerMethodField()
    user_submission = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'course', 'module', 'module_title', 'title', 'description',
            'assignment_type', 'assignment_type_display', 'instructions',
            'attachment', 'max_points', 'passing_points', 'available_from',
            'due_date', 'late_submission_allowed', 'late_penalty_percentage',
            'is_published', 'allow_resubmission', 'max_attempts',
            'total_submissions', 'graded_submissions', 'user_submission',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_total_submissions(self, obj) -> Any:
        return obj.submissions.count()

    def get_graded_submissions(self, obj) -> Any:
        return obj.submissions.filter(graded_at__isnull=False).count()

    def get_user_submission(self, obj) -> Any:
        """Get current user's submission if exists"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        try:
            submission = AssignmentSubmission.objects.get(
                assignment=obj,
                student=request.user
            )
            return {
                'id': submission.id,
                'submitted_at': submission.submitted_at,
                'status': submission.status,
                'points_earned': submission.points_earned,
                'is_late': submission.is_late
            }
        except AssignmentSubmission.DoesNotExist:
            return None


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    """Assignment submission serializer"""
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    graded_by_name = serializers.CharField(source='graded_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment', 'assignment_title', 'student', 'student_name',
            'text_content', 'file', 'status', 'status_display', 'attempt_number',
            'points_earned', 'feedback', 'graded_by', 'graded_by_name',
            'submitted_at', 'graded_at', 'is_late',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'submitted_at', 'is_late', 'graded_at', 'attempt_number']


class AssignmentSubmissionCreateSerializer(serializers.ModelSerializer):
    """Create assignment submission"""

    class Meta:
        model = AssignmentSubmission
        fields = ['assignment', 'text_content', 'file']

    def create(self, validated_data):
        assignment = validated_data['assignment']
        student = self.context['request'].user

        # Calculate attempt number
        attempt_number = AssignmentSubmission.objects.filter(
            assignment=assignment,
            student=student
        ).count() + 1

        # Check if late
        is_late = timezone.now() > assignment.due_date if assignment.due_date else False

        submission = AssignmentSubmission.objects.create(
            student=student,
            attempt_number=attempt_number,
            is_late=is_late,
            status='submitted',
            submitted_at=timezone.now(),
            **validated_data
        )

        return submission


class AssignmentSubmissionGradeSerializer(serializers.ModelSerializer):
    """Grade assignment submission"""

    class Meta:
        model = AssignmentSubmission
        fields = ['points_earned', 'feedback']

    def update(self, instance, validated_data):
        instance.points_earned = validated_data.get('points_earned', instance.points_earned)
        instance.feedback = validated_data.get('feedback', instance.feedback)
        instance.status = 'graded'
        instance.graded_by = self.context['request'].user
        instance.graded_at = timezone.now()
        instance.save()
        return instance


class QuestionOptionSerializer(serializers.ModelSerializer):
    """Question option serializer"""

    class Meta:
        model = QuestionOption
        fields = ['id', 'option_text', 'is_correct', 'order']


class QuestionSerializer(serializers.ModelSerializer):
    """Question serializer"""
    question_type_display = serializers.CharField(source='get_question_type_display', read_only=True)
    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'quiz', 'question_type', 'question_type_display',
            'question_text', 'explanation', 'points', 'order',
            'is_required', 'options', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class QuestionCreateSerializer(serializers.ModelSerializer):
    """Create/update question with options"""
    options = QuestionOptionSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = [
            'quiz', 'question_type', 'question_text', 'explanation',
            'points', 'order', 'is_required', 'options'
        ]

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        question = Question.objects.create(**validated_data)

        # Create options
        for option_data in options_data:
            QuestionOption.objects.create(question=question, **option_data)

        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', [])

        # Update question
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update options (delete old, create new)
        if options_data:
            instance.options.all().delete()
            for option_data in options_data:
                QuestionOption.objects.create(question=instance, **option_data)

        return instance


class QuizSerializer(serializers.ModelSerializer):
    """Quiz serializer"""
    module_title = serializers.CharField(source='module.title', read_only=True)
    quiz_type_display = serializers.CharField(source='get_quiz_type_display', read_only=True)
    question_count = serializers.SerializerMethodField()
    total_points = serializers.SerializerMethodField()
    user_best_attempt = serializers.SerializerMethodField()
    user_attempts_count = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'id', 'course', 'module', 'lesson', 'module_title', 'title',
            'description', 'quiz_type', 'quiz_type_display',
            'time_limit_minutes', 'passing_score', 'show_correct_answers',
            'shuffle_questions', 'shuffle_answers', 'max_attempts',
            'allow_review', 'available_from', 'available_until',
            'is_published', 'question_count', 'total_points',
            'user_best_attempt', 'user_attempts_count',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_question_count(self, obj) -> Any:
        return obj.questions.count()

    def get_total_points(self, obj) -> Any:
        return obj.questions.aggregate(total=models.Sum('points'))['total'] or 0

    def get_user_best_attempt(self, obj) -> Any:
        """Get user's best attempt score"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        best_attempt = QuizAttempt.objects.filter(
            quiz=obj,
            student=request.user,
            status__in=['submitted', 'graded']
        ).order_by('-percentage_score').first()

        if best_attempt:
            return {
                'id': best_attempt.id,
                'percentage_score': float(best_attempt.percentage_score),
                'points_earned': float(best_attempt.points_earned),
                'passed': best_attempt.passed,
                'submitted_at': best_attempt.submitted_at
            }
        return None

    def get_user_attempts_count(self, obj) -> Any:
        """Count user's attempts"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        return QuizAttempt.objects.filter(
            quiz=obj,
            student=request.user,
            status__in=['submitted', 'graded']
        ).count()


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Quiz attempt serializer"""
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    answers = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            'id', 'quiz', 'quiz_title', 'student', 'student_name',
            'attempt_number', 'status', 'status_display', 'started_at',
            'submitted_at', 'time_taken_seconds', 'total_points',
            'points_earned', 'percentage_score', 'passed', 'answers',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'started_at', 'submitted_at', 'passed']

    def get_answers(self, obj) -> Any:
        """Get all answers for this attempt"""
        answers = QuizAnswer.objects.filter(attempt=obj).select_related('question')
        return QuizAnswerSerializer(answers, many=True).data


class QuizAttemptCreateSerializer(serializers.ModelSerializer):
    """Start a quiz attempt"""

    class Meta:
        model = QuizAttempt
        fields = ['quiz']

    def create(self, validated_data):
        quiz = validated_data['quiz']
        student = self.context['request'].user

        # Check max attempts
        attempts_count = QuizAttempt.objects.filter(
            quiz=quiz,
            student=student,
            status__in=['submitted', 'graded']
        ).count()

        if quiz.max_attempts > 0 and attempts_count >= quiz.max_attempts:
            raise serializers.ValidationError(
                f'Maximum attempts ({quiz.max_attempts}) reached for this quiz'
            )

        # Calculate total points
        total_points = quiz.questions.aggregate(
            total=models.Sum('points')
        )['total'] or 0

        attempt = QuizAttempt.objects.create(
            student=student,
            quiz=quiz,
            attempt_number=attempts_count + 1,
            total_points=total_points,
            status='in_progress'
        )

        return attempt


class QuizAnswerSerializer(serializers.ModelSerializer):
    """Quiz answer serializer"""
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    correct_answer_text = serializers.SerializerMethodField()

    class Meta:
        model = QuizAnswer
        fields = [
            'id', 'attempt', 'question', 'question_text', 'question_type',
            'selected_option', 'text_answer', 'is_correct',
            'points_earned', 'feedback', 'graded_by',
            'correct_answer_text', 'created_at'
        ]
        read_only_fields = ['created_at', 'is_correct', 'points_earned']

    def get_correct_answer_text(self, obj) -> Any:
        """Show correct answer (only if quiz allows or after submission)"""
        if not obj.attempt.quiz.show_correct_answers and obj.attempt.status == 'in_progress':
            return None

        if obj.question.question_type == 'multiple_choice':
            correct_option = obj.question.options.filter(is_correct=True).first()
            return correct_option.option_text if correct_option else None
        elif obj.question.question_type == 'true_false':
            correct_option = obj.question.options.filter(is_correct=True).first()
            return correct_option.option_text if correct_option else None
        else:
            # For essay/short answer, no single correct answer
            return obj.question.explanation


class QuizAnswerSubmitSerializer(serializers.ModelSerializer):
    """Submit answer to a question"""

    class Meta:
        model = QuizAnswer
        fields = ['attempt', 'question', 'selected_option', 'text_answer']

    def validate(self, attrs):
        attempt = attrs['attempt']
        question = attrs['question']
        selected_option = attrs.get('selected_option')

        if attempt.status != 'in_progress':
            raise serializers.ValidationError({'attempt': 'Attempt is not in progress'})

        if question.quiz_id != attempt.quiz_id:
            raise serializers.ValidationError({'question': 'Question does not belong to this attempt quiz'})

        if selected_option and selected_option.question_id != question.id:
            raise serializers.ValidationError({'selected_option': 'Selected option does not belong to question'})

        return attrs

    def create(self, validated_data):
        question = validated_data['question']
        selected_option = validated_data.get('selected_option')

        # Auto-grade objective questions
        is_correct = False
        points_earned = 0

        if question.question_type in ['multiple_choice', 'true_false']:
            if selected_option and selected_option.is_correct:
                is_correct = True
                points_earned = question.points

        answer, _ = QuizAnswer.objects.update_or_create(
            attempt=validated_data['attempt'],
            question=question,
            defaults={
                'selected_option': selected_option,
                'text_answer': validated_data.get('text_answer', ''),
                'is_correct': is_correct,
                'points_earned': points_earned,
            }
        )

        return answer


# Import for aggregation
from django.db import models

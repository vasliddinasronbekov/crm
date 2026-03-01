"""
SAT 2025 Serializers
API serialization for SAT exams, questions, attempts, and answers
"""

from rest_framework import serializers
from .sat_models import (
    SATExam, SATModule, SATQuestion,
    SATAttempt, SATAnswer
)


class SATQuestionSerializer(serializers.ModelSerializer):
    """Serializer for SAT questions"""
    section = serializers.CharField(source='module.section', read_only=True)
    module_number = serializers.IntegerField(source='module.module_number', read_only=True)

    class Meta:
        model = SATQuestion
        fields = [
            'id', 'module', 'section', 'module_number',
            'question_number', 'passage_text', 'question_text',
            'rw_type', 'math_type', 'answer_type',
            'options', 'difficulty_level', 'points', 'order'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        """Hide correct answer from students"""
        data = super().to_representation(instance)
        request = self.context.get('request')

        # Only show correct_answer to staff/admin or after attempt is completed
        if request and (request.user.is_staff or self.context.get('show_answers', False)):
            data['correct_answer'] = instance.correct_answer
            data['explanation'] = instance.explanation

        return data


class SATModuleSerializer(serializers.ModelSerializer):
    """Serializer for SAT modules"""
    questions = SATQuestionSerializer(many=True, read_only=True)
    question_count = serializers.SerializerMethodField()
    section_display = serializers.CharField(source='get_section_display', read_only=True)

    class Meta:
        model = SATModule
        fields = [
            'id', 'exam', 'section', 'section_display',
            'module_number', 'difficulty', 'time_minutes',
            'order', 'questions', 'question_count'
        ]
        read_only_fields = ['id']

    def get_question_count(self, obj):
        return obj.questions.count()


class SATExamSerializer(serializers.ModelSerializer):
    """Serializer for SAT exam list view"""

    class Meta:
        model = SATExam
        fields = [
            'id', 'title', 'description',
            'coin_cost', 'coin_refund', 'passing_score',
            'rw_total_questions', 'rw_time_minutes',
            'math_total_questions', 'math_time_minutes',
            'is_official', 'is_published', 'test_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SATExamDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with modules and questions"""
    modules = SATModuleSerializer(many=True, read_only=True)
    total_questions = serializers.SerializerMethodField()
    total_time_minutes = serializers.SerializerMethodField()

    class Meta:
        model = SATExam
        fields = [
            'id', 'title', 'description',
            'coin_cost', 'coin_refund', 'passing_score',
            'rw_total_questions', 'rw_time_minutes',
            'math_total_questions', 'math_time_minutes',
            'total_questions', 'total_time_minutes',
            'is_official', 'is_published', 'test_number',
            'modules', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_questions(self, obj):
        return obj.rw_total_questions + obj.math_total_questions

    def get_total_time_minutes(self, obj):
        return obj.rw_time_minutes + obj.math_time_minutes


class SATAnswerSerializer(serializers.ModelSerializer):
    """Serializer for student answers"""
    question_number = serializers.IntegerField(source='question.question_number', read_only=True)
    question_details = SATQuestionSerializer(source='question', read_only=True)

    class Meta:
        model = SATAnswer
        fields = [
            'id', 'attempt', 'question', 'question_number',
            'question_details',
            'answer_given', 'is_correct', 'points_earned',
            'time_spent_seconds', 'answered_at'
        ]
        read_only_fields = ['id', 'is_correct', 'points_earned', 'answered_at']


class SATAnswerSubmitSerializer(serializers.Serializer):
    """Serializer for submitting an answer"""
    question_id = serializers.IntegerField()
    answer_given = serializers.JSONField()
    time_spent_seconds = serializers.IntegerField(default=0)


class SATAttemptSerializer(serializers.ModelSerializer):
    """Serializer for SAT attempts list view"""
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_resume = serializers.SerializerMethodField()

    class Meta:
        model = SATAttempt
        fields = [
            'id', 'exam', 'exam_title', 'status', 'status_display',
            'coins_paid', 'coins_refunded', 'refund_eligible',
            'total_score', 'reading_writing_score', 'math_score',
            'rw_correct', 'math_correct',
            'current_module_key', 'current_question_index',
            'module_time_remaining_seconds', 'last_state_synced_at',
            'can_resume',
            'started_at', 'completed_at', 'time_taken_seconds',
            'created_at'
        ]
        read_only_fields = [
            'id', 'status', 'coins_paid', 'coins_refunded',
            'total_score', 'reading_writing_score', 'math_score',
            'rw_correct', 'math_correct', 'started_at', 'completed_at',
            'time_taken_seconds', 'created_at'
        ]

    def get_can_resume(self, obj):
        return obj.status in {'payment_pending', 'in_progress'}


class SATAttemptDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with answers and feedback"""
    exam_detail = SATExamDetailSerializer(source='exam', read_only=True)
    exam_details = SATExamDetailSerializer(source='exam', read_only=True)
    answers = SATAnswerSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Performance breakdown
    rw_percentage = serializers.SerializerMethodField()
    math_percentage = serializers.SerializerMethodField()
    can_resume = serializers.SerializerMethodField()

    class Meta:
        model = SATAttempt
        fields = [
            'id', 'student', 'exam', 'exam_detail', 'exam_details',
            'status', 'status_display',
            'coins_paid', 'coins_refunded', 'refund_eligible',
            'current_module_key', 'current_question_index',
            'module_time_remaining_seconds', 'last_state_synced_at', 'can_resume',
            'started_at', 'completed_at', 'time_taken_seconds',
            'reading_writing_score', 'math_score', 'total_score',
            'rw_correct', 'math_correct',
            'rw_percentage', 'math_percentage',
            'rw_module1_correct', 'rw_module2_difficulty',
            'math_module1_correct', 'math_module2_difficulty',
            'ai_feedback', 'answers',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'status', 'coins_paid', 'coins_refunded',
            'started_at', 'completed_at', 'time_taken_seconds',
            'total_score', 'reading_writing_score', 'math_score',
            'rw_correct', 'math_correct', 'ai_feedback',
            'created_at', 'updated_at'
        ]

    def get_rw_percentage(self, obj):
        if obj.exam.rw_total_questions > 0:
            return round((obj.rw_correct / obj.exam.rw_total_questions) * 100, 1)
        return 0

    def get_math_percentage(self, obj):
        if obj.exam.math_total_questions > 0:
            return round((obj.math_correct / obj.exam.math_total_questions) * 100, 1)
        return 0

    def get_can_resume(self, obj):
        return obj.status in {'payment_pending', 'in_progress'}


class CreateSATAttemptSerializer(serializers.Serializer):
    """Serializer for creating a new SAT attempt"""
    exam_id = serializers.IntegerField()

    def validate_exam_id(self, value):
        """Verify exam exists and is published"""
        try:
            exam = SATExam.objects.get(id=value, is_published=True)
        except SATExam.DoesNotExist:
            raise serializers.ValidationError("Exam not found or not published")
        return value

    def create(self, validated_data):
        """Create new attempt"""
        user = self.context['request'].user
        exam = SATExam.objects.get(id=validated_data['exam_id'])

        existing_attempt = SATAttempt.objects.filter(
            student=user,
            exam=exam,
            status__in=['payment_pending', 'in_progress'],
        ).order_by('-created_at').first()
        if existing_attempt:
            return existing_attempt

        attempt = SATAttempt.objects.create(
            student=user,
            exam=exam,
            status='payment_pending'
        )

        return attempt


class CompleteSATAttemptSerializer(serializers.Serializer):
    """Serializer for completing an attempt"""
    answers = SATAnswerSubmitSerializer(many=True)

    def validate_answers(self, value):
        """Validate all required questions are answered"""
        if not value:
            raise serializers.ValidationError("At least one answer is required")
        return value

"""
Serializers for Exam Draft and Notification System
"""
from typing import Any

from rest_framework import serializers
from .exam_draft_models import (
    IELTSExamDraft, IELTSQuestionDraft,
    AIExamGenerationRequest, ExamDraftStatus
)
from .notification_models import Notification, InboxSettings
from users.serializers import UserBasicSerializer


class IELTSQuestionDraftSerializer(serializers.ModelSerializer):
    """Serializer for question drafts"""

    class Meta:
        model = IELTSQuestionDraft
        fields = [
            'id', 'exam_draft', 'question_type', 'order',
            'passage_text', 'audio_file', 'question_text',
            'options', 'correct_answer', 'points',
            'speaking_prompts', 'time_limit_seconds',
            'ai_feedback', 'created_at'
        ]
        read_only_fields = ['id', 'ai_feedback', 'created_at']


class IELTSExamDraftListSerializer(serializers.ModelSerializer):
    """Serializer for exam draft list view"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    question_count = serializers.SerializerMethodField()
    can_submit_for_review = serializers.SerializerMethodField()
    can_submit_for_approval = serializers.SerializerMethodField()

    class Meta:
        model = IELTSExamDraft
        fields = [
            'id', 'section', 'title', 'description',
            'coin_cost', 'coin_refund', 'time_limit_minutes',
            'passing_band_score', 'status', 'status_display',
            'created_by', 'created_by_name',
            'ai_quality_score', 'ai_reviewed_at',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'is_ai_generated', 'version',
            'question_count', 'can_submit_for_review',
            'can_submit_for_approval',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'status', 'ai_quality_score',
            'ai_reviewed_at', 'reviewed_by', 'reviewed_at',
            'created_at', 'updated_at'
        ]

    def get_question_count(self, obj) -> Any:
        return obj.draft_questions.count()

    def get_can_submit_for_review(self, obj) -> Any:
        return obj.status == ExamDraftStatus.DRAFT and obj.draft_questions.count() > 0

    def get_can_submit_for_approval(self, obj) -> Any:
        return obj.status == ExamDraftStatus.AI_REVIEWED


class IELTSExamDraftDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with questions and AI feedback"""
    created_by_info = UserBasicSerializer(source='created_by', read_only=True)
    reviewed_by_info = UserBasicSerializer(source='reviewed_by', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    questions = IELTSQuestionDraftSerializer(source='draft_questions', many=True, read_only=True)

    class Meta:
        model = IELTSExamDraft
        fields = [
            'id', 'section', 'title', 'description',
            'coin_cost', 'coin_refund', 'time_limit_minutes',
            'passing_band_score', 'instructions',
            'status', 'status_display',
            'created_by', 'created_by_info',
            'ai_suggestions', 'ai_quality_score', 'ai_reviewed_at',
            'submitted_for_review_at',
            'reviewed_by', 'reviewed_by_info',
            'reviewed_at', 'review_comments',
            'published_exam', 'published_at',
            'version', 'is_ai_generated',
            'questions',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'status', 'ai_suggestions',
            'ai_quality_score', 'ai_reviewed_at',
            'submitted_for_review_at', 'reviewed_by',
            'reviewed_at', 'published_exam', 'published_at',
            'created_at', 'updated_at'
        ]


class IELTSExamDraftCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating exam drafts"""
    questions = IELTSQuestionDraftSerializer(many=True, required=False)

    class Meta:
        model = IELTSExamDraft
        fields = [
            'section', 'title', 'description',
            'coin_cost', 'coin_refund', 'time_limit_minutes',
            'passing_band_score', 'instructions',
            'questions'
        ]

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        validated_data['created_by'] = self.context['request'].user

        exam_draft = IELTSExamDraft.objects.create(**validated_data)

        # Create questions
        for q_data in questions_data:
            IELTSQuestionDraft.objects.create(exam_draft=exam_draft, **q_data)

        return exam_draft


class ExamApprovalSerializer(serializers.Serializer):
    """Serializer for approving/rejecting exams"""
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    comments = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['action'] == 'reject' and not data.get('comments'):
            raise serializers.ValidationError({
                'comments': 'Comments are required when rejecting an exam'
            })
        return data


class AIExamGenerationRequestSerializer(serializers.ModelSerializer):
    """Serializer for AI exam generation"""
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AIExamGenerationRequest
        fields = [
            'id', 'section', 'difficulty_level', 'topic',
            'custom_instructions', 'status', 'status_display',
            'requested_by', 'requested_by_name',
            'generated_draft', 'error_message',
            'created_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'status', 'requested_by', 'generated_draft',
            'error_message', 'created_at', 'completed_at'
        ]

    def create(self, validated_data):
        validated_data['requested_by'] = self.context['request'].user
        request_obj = AIExamGenerationRequest.objects.create(**validated_data)

        # Trigger AI generation
        from .exam_draft_tasks import generate_exam_with_ai
        generate_exam_with_ai.delay(request_obj.id)

        return request_obj


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications"""
    type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    exam_title = serializers.CharField(source='exam_draft.title', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'type_display',
            'title', 'message',
            'exam_draft', 'exam_title',
            'action_url', 'action_label',
            'is_read', 'read_at',
            'created_at'
        ]
        read_only_fields = [
            'id', 'notification_type', 'title', 'message',
            'exam_draft', 'action_url', 'action_label',
            'read_at', 'created_at'
        ]


class InboxSettingsSerializer(serializers.ModelSerializer):
    """Serializer for inbox settings"""

    class Meta:
        model = InboxSettings
        fields = [
            'email_on_approval_request',
            'email_on_exam_approved',
            'email_on_exam_rejected',
            'email_on_ai_review',
            'push_enabled',
            'updated_at'
        ]
        read_only_fields = ['updated_at']

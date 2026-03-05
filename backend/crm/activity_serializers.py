"""
CRM Activity and Pipeline Serializers
"""
from typing import Any

from rest_framework import serializers
from .activity_models import Activity, Pipeline, PipelineStage, Deal
from .models import Lead
from users.serializers import UserSerializer


class ActivitySerializer(serializers.ModelSerializer):
    """Activity serializer with user details"""
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = Activity
        fields = [
            'id', 'lead', 'activity_type', 'activity_type_display',
            'subject', 'description', 'due_date', 'completed', 'completed_at',
            'priority', 'priority_display', 'created_by', 'assigned_to',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'completed_at']


class ActivityCreateSerializer(serializers.ModelSerializer):
    """Create activity with current user as creator"""

    class Meta:
        model = Activity
        fields = [
            'lead', 'activity_type', 'subject', 'description',
            'due_date', 'priority', 'assigned_to'
        ]

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class PipelineStageSerializer(serializers.ModelSerializer):
    """Pipeline stage serializer"""

    class Meta:
        model = PipelineStage
        fields = ['id', 'pipeline', 'name', 'description', 'order', 'probability', 'color', 'is_active']


class PipelineSerializer(serializers.ModelSerializer):
    """Pipeline with stages"""
    stages = PipelineStageSerializer(many=True, read_only=True)
    total_deals = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = Pipeline
        fields = ['id', 'name', 'description', 'is_default', 'is_active', 'stages', 'total_deals', 'total_value', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def get_total_deals(self, obj) -> Any:
        return Deal.objects.filter(pipeline=obj).count()

    def get_total_value(self, obj) -> Any:
        deals = Deal.objects.filter(pipeline=obj)
        return sum(float(deal.value) for deal in deals)


class LeadMinimalSerializer(serializers.ModelSerializer):
    """Minimal lead info for deals"""

    class Meta:
        model = Lead
        fields = ['id', 'full_name', 'phone', 'status']


class DealSerializer(serializers.ModelSerializer):
    """Deal serializer with lead details"""
    lead = LeadMinimalSerializer(read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    pipeline_name = serializers.CharField(source='pipeline.name', read_only=True)

    class Meta:
        model = Deal
        fields = [
            'id', 'lead', 'pipeline', 'pipeline_name', 'stage', 'stage_name',
            'value', 'currency', 'weighted_value', 'expected_close_date',
            'probability', 'closed_at', 'won', 'lost_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['weighted_value', 'created_at', 'updated_at']


class DealCreateSerializer(serializers.ModelSerializer):
    """Create deal from lead"""

    class Meta:
        model = Deal
        fields = ['lead', 'pipeline', 'stage', 'value', 'currency', 'expected_close_date', 'probability']

    def validate(self, data):
        # Check if deal already exists for this lead
        if Deal.objects.filter(lead=data['lead']).exists():
            raise serializers.ValidationError("Deal already exists for this lead")
        return data


class DealMoveStageSerializer(serializers.Serializer):
    """Move deal to new stage"""
    stage_id = serializers.IntegerField()

    def validate_stage_id(self, value):
        try:
            PipelineStage.objects.get(id=value)
        except PipelineStage.DoesNotExist:
            raise serializers.ValidationError("Invalid stage ID")
        return value

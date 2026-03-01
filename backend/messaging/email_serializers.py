"""
Email Marketing System Serializers
"""

from rest_framework import serializers
from .email_models import EmailTemplate, EmailCampaign, EmailLog, AutomatedEmail
from users.serializers import UserSerializer


class EmailTemplateSerializer(serializers.ModelSerializer):
    """Email template serializer"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'name', 'template_type', 'template_type_display',
            'subject', 'html_content', 'text_content', 'variables',
            'is_active', 'from_email', 'from_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class EmailCampaignSerializer(serializers.ModelSerializer):
    """Email campaign serializer"""
    template_name = serializers.CharField(source='template.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    recipient_type_display = serializers.CharField(source='get_recipient_type_display', read_only=True)

    # Statistics
    open_rate = serializers.SerializerMethodField()
    click_rate = serializers.SerializerMethodField()

    class Meta:
        model = EmailCampaign
        fields = [
            'id', 'name', 'template', 'template_name',
            'subject', 'html_content', 'text_content',
            'recipient_type', 'recipient_type_display',
            'specific_course', 'specific_group', 'custom_recipients',
            'status', 'status_display', 'scheduled_for', 'sent_at',
            'total_recipients', 'emails_sent', 'emails_failed',
            'emails_opened', 'emails_clicked',
            'open_rate', 'click_rate',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'sent_at', 'emails_sent', 'emails_failed', 'emails_opened', 'emails_clicked']

    def get_open_rate(self, obj):
        if obj.emails_sent > 0:
            return round((obj.emails_opened / obj.emails_sent) * 100, 2)
        return 0

    def get_click_rate(self, obj):
        if obj.emails_sent > 0:
            return round((obj.emails_clicked / obj.emails_sent) * 100, 2)
        return 0


class EmailCampaignCreateSerializer(serializers.ModelSerializer):
    """Create/update email campaign"""

    class Meta:
        model = EmailCampaign
        fields = [
            'name', 'template', 'subject', 'html_content', 'text_content',
            'recipient_type', 'specific_course', 'specific_group', 'custom_recipients',
            'scheduled_for'
        ]

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class EmailLogSerializer(serializers.ModelSerializer):
    """Email log serializer"""
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = EmailLog
        fields = [
            'id', 'campaign', 'campaign_name', 'template',
            'recipient', 'recipient_name', 'recipient_email',
            'subject', 'status', 'status_display',
            'sent_at', 'delivered_at', 'opened_at', 'clicked_at',
            'error_message', 'external_id', 'created_at'
        ]
        read_only_fields = ['created_at']


class AutomatedEmailSerializer(serializers.ModelSerializer):
    """Automated email serializer"""
    template_name = serializers.CharField(source='template.name', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)

    class Meta:
        model = AutomatedEmail
        fields = [
            'id', 'name', 'trigger_type', 'trigger_type_display',
            'template', 'template_name', 'is_active',
            'trigger_delay_minutes', 'conditions',
            'times_triggered', 'last_triggered',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'times_triggered', 'last_triggered']

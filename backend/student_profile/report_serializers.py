"""
Report and Reminder Serializers
Serializers for scheduled reports and payment reminders
"""
from rest_framework import serializers
from .report_models import (
    ScheduledReport,
    ReportGeneration,
    PaymentReminderSettings,
    PaymentReminder
)


class ScheduledReportSerializer(serializers.ModelSerializer):
    """Serializer for scheduled reports"""

    created_by_name = serializers.SerializerMethodField()
    recipients_list = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledReport
        fields = [
            'id',
            'report_type',
            'frequency',
            'day_of_week',
            'time',
            'recipients',
            'recipients_list',
            'enabled',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'last_run',
            'next_run',
            'parameters',
            'status_display',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_run', 'next_run']

    def get_created_by_name(self, obj):
        """Get the name of the user who created this schedule"""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "Unknown"

    def get_recipients_list(self, obj):
        """Return recipients as a list"""
        return obj.get_recipients_list()

    def get_status_display(self, obj):
        """Return user-friendly status"""
        if not obj.enabled:
            return "Disabled"
        if obj.next_run:
            return f"Active (Next: {obj.next_run.strftime('%Y-%m-%d %H:%M')})"
        return "Active"

    def validate_recipients(self, value):
        """Validate email addresses"""
        emails = [email.strip() for email in value.split(',') if email.strip()]
        if not emails:
            raise serializers.ValidationError("At least one recipient email is required")

        # Basic email validation
        import re
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        for email in emails:
            if not email_pattern.match(email):
                raise serializers.ValidationError(f"Invalid email address: {email}")

        return value

    def validate(self, data):
        """Cross-field validation"""
        # Weekly reports must have day_of_week
        if data.get('frequency') == 'weekly' and not data.get('day_of_week'):
            raise serializers.ValidationError({
                'day_of_week': 'Day of week is required for weekly reports'
            })

        return data

    def create(self, validated_data):
        """Create scheduled report and calculate next run"""
        # Set created_by from request user
        validated_data['created_by'] = self.context['request'].user

        scheduled_report = super().create(validated_data)
        scheduled_report.calculate_next_run()

        return scheduled_report

    def update(self, instance, validated_data):
        """Update and recalculate next run if necessary"""
        # Check if frequency or time changed
        recalculate = False
        if 'frequency' in validated_data or 'time' in validated_data or 'day_of_week' in validated_data:
            recalculate = True

        instance = super().update(instance, validated_data)

        if recalculate:
            instance.calculate_next_run()

        return instance


class ReportGenerationSerializer(serializers.ModelSerializer):
    """Serializer for report generation tracking"""

    scheduled_report_info = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = ReportGeneration
        fields = [
            'id',
            'scheduled_report',
            'scheduled_report_info',
            'report_type',
            'status',
            'started_at',
            'completed_at',
            'duration',
            'file_path',
            'file_url',
            'error_message',
            'parameters',
            'result_data',
        ]
        read_only_fields = ['id', 'started_at', 'completed_at', 'duration']

    def get_scheduled_report_info(self, obj):
        """Get information about the scheduled report"""
        if obj.scheduled_report:
            return {
                'id': obj.scheduled_report.id,
                'type': obj.scheduled_report.get_report_type_display(),
                'frequency': obj.scheduled_report.get_frequency_display(),
            }
        return None

    def get_duration(self, obj):
        """Calculate generation duration in seconds"""
        if obj.started_at and obj.completed_at:
            delta = obj.completed_at - obj.started_at
            return round(delta.total_seconds(), 2)
        return None


class PaymentReminderSettingsSerializer(serializers.ModelSerializer):
    """Serializer for payment reminder settings"""

    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentReminderSettings
        fields = [
            'id',
            'enabled',
            'days_before_due',
            'frequency',
            'email_template',
            'created_by',
            'created_by_name',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def get_created_by_name(self, obj):
        """Get the name of the user who created/updated settings"""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"

    def validate_days_before_due(self, value):
        """Validate days before due is in valid range"""
        if value < 1 or value > 30:
            raise serializers.ValidationError("Days before due must be between 1 and 30")
        return value

    def create(self, validated_data):
        """Set created_by from request user"""
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class PaymentReminderSerializer(serializers.ModelSerializer):
    """Serializer for individual payment reminders"""

    payment_info = serializers.SerializerMethodField()
    student_info = serializers.SerializerMethodField()

    class Meta:
        model = PaymentReminder
        fields = [
            'id',
            'payment',
            'payment_info',
            'student_info',
            'recipient_email',
            'template_used',
            'status',
            'scheduled_at',
            'sent_at',
            'email_provider_id',
            'error_message',
            'metadata',
        ]
        read_only_fields = ['id', 'scheduled_at', 'sent_at']

    def get_payment_info(self, obj):
        """Get payment details"""
        payment = obj.payment
        return {
            'id': payment.id,
            'amount': payment.amount / 100,  # Convert from tiyin to sum
            'status': payment.status,
            'date': payment.date,
            'due_date': payment.due_date if hasattr(payment, 'due_date') else None,
        }

    def get_student_info(self, obj):
        """Get student details"""
        student = obj.payment.by_user
        return {
            'id': student.id,
            'name': f"{student.first_name} {student.last_name}".strip() or student.username,
            'email': student.email,
        }


class BulkPaymentReminderSerializer(serializers.Serializer):
    """Serializer for bulk payment reminder requests"""

    payment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="List of payment IDs to send reminders for"
    )
    template = serializers.ChoiceField(
        choices=PaymentReminderSettings.TEMPLATE_CHOICES,
        default='default',
        help_text="Email template to use"
    )
    custom_message = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        help_text="Optional custom message to include"
    )

    def validate_payment_ids(self, value):
        """Validate payment IDs exist and are pending"""
        from .models import Payment

        if len(value) > 100:
            raise serializers.ValidationError("Cannot send more than 100 reminders at once")

        # Check if payments exist and are pending
        payments = Payment.objects.filter(id__in=value, status='pending')
        found_ids = set(payments.values_list('id', flat=True))
        missing_ids = set(value) - found_ids

        if missing_ids:
            raise serializers.ValidationError(
                f"Invalid or non-pending payment IDs: {', '.join(map(str, missing_ids))}"
            )

        return value

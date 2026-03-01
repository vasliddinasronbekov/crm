"""
Report Scheduling Models
Models for automated report generation and scheduling
"""
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class ScheduledReport(models.Model):
    """
    Scheduled report configuration
    Stores information about reports that should be generated automatically
    """
    REPORT_TYPES = [
        ('attendance', 'Student Attendance Report'),
        ('enrollment', 'Course Enrollment Report'),
        ('performance', 'Performance Analytics'),
        ('revenue', 'Revenue by Course'),
        ('lead_conversion', 'Lead Conversion Report'),
        ('profit_loss', 'Profit & Loss Statement'),
        ('cash_flow', 'Cash Flow Statement'),
        ('accounts_receivable', 'Accounts Receivable Report'),
        ('teacher_compensation', 'Teacher Compensation Report'),
        ('custom', 'Custom Report'),
    ]

    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]

    DAY_OF_WEEK_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]

    # Report Configuration
    report_type = models.CharField(max_length=50, choices=REPORT_TYPES)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    day_of_week = models.CharField(
        max_length=20,
        choices=DAY_OF_WEEK_CHOICES,
        null=True,
        blank=True,
        help_text="Required for weekly reports"
    )
    time = models.TimeField(help_text="Time to generate report (24-hour format)")

    # Recipients
    recipients = models.TextField(
        help_text="Comma-separated email addresses"
    )

    # Status and Control
    enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_scheduled_reports'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)

    # Metadata
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional parameters for report generation"
    )

    class Meta:
        db_table = 'scheduled_reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['enabled', 'next_run']),
            models.Index(fields=['report_type']),
        ]

    def __str__(self):
        return f"{self.get_report_type_display()} - {self.frequency}"

    def get_recipients_list(self):
        """Returns a list of email addresses"""
        return [email.strip() for email in self.recipients.split(',') if email.strip()]

    def calculate_next_run(self):
        """Calculate the next run time based on frequency"""
        from datetime import datetime, timedelta

        now = timezone.now()

        if self.frequency == 'daily':
            # Run at the same time tomorrow
            next_run = now.replace(
                hour=self.time.hour,
                minute=self.time.minute,
                second=0,
                microsecond=0
            )
            if next_run <= now:
                next_run += timedelta(days=1)

        elif self.frequency == 'weekly':
            # Find next occurrence of the specified day
            days_of_week = {
                'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                'friday': 4, 'saturday': 5, 'sunday': 6
            }
            target_day = days_of_week.get(self.day_of_week, 0)
            current_day = now.weekday()
            days_ahead = (target_day - current_day) % 7

            if days_ahead == 0:
                # It's today, check if time has passed
                next_run = now.replace(
                    hour=self.time.hour,
                    minute=self.time.minute,
                    second=0,
                    microsecond=0
                )
                if next_run <= now:
                    days_ahead = 7

            next_run = now + timedelta(days=days_ahead)
            next_run = next_run.replace(
                hour=self.time.hour,
                minute=self.time.minute,
                second=0,
                microsecond=0
            )

        elif self.frequency == 'monthly':
            # Run on the same day next month
            next_run = now.replace(
                hour=self.time.hour,
                minute=self.time.minute,
                second=0,
                microsecond=0
            )

            # Move to next month
            if next_run <= now:
                if next_run.month == 12:
                    next_run = next_run.replace(year=next_run.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=next_run.month + 1)

        self.next_run = next_run
        self.save(update_fields=['next_run'])
        return next_run


class ReportGeneration(models.Model):
    """
    Track individual report generation instances
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    scheduled_report = models.ForeignKey(
        ScheduledReport,
        on_delete=models.CASCADE,
        related_name='generations',
        null=True,
        blank=True
    )

    report_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Generation details
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Output
    file_path = models.CharField(max_length=500, blank=True)
    file_url = models.URLField(max_length=500, blank=True)

    # Error tracking
    error_message = models.TextField(blank=True)

    # Metadata
    parameters = models.JSONField(default=dict, blank=True)
    result_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'report_generations'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['status', 'started_at']),
        ]

    def __str__(self):
        return f"{self.report_type} - {self.status}"


class PaymentReminderSettings(models.Model):
    """
    Global settings for automated payment reminders
    """
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
    ]

    TEMPLATE_CHOICES = [
        ('default', 'Default Template'),
        ('friendly', 'Friendly Reminder'),
        ('urgent', 'Urgent Notice'),
        ('final', 'Final Notice'),
    ]

    # Settings
    enabled = models.BooleanField(default=False)
    days_before_due = models.IntegerField(
        default=3,
        help_text="Send reminder X days before payment due date"
    )
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='daily'
    )
    email_template = models.CharField(
        max_length=20,
        choices=TEMPLATE_CHOICES,
        default='default'
    )

    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='reminder_settings'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_reminder_settings'
        verbose_name = 'Payment Reminder Settings'
        verbose_name_plural = 'Payment Reminder Settings'

    def __str__(self):
        return f"Reminder Settings - {'Enabled' if self.enabled else 'Disabled'}"


class PaymentReminder(models.Model):
    """
    Track individual payment reminder sends
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
    ]

    payment = models.ForeignKey(
        'Payment',
        on_delete=models.CASCADE,
        related_name='reminders'
    )

    recipient_email = models.EmailField()
    template_used = models.CharField(max_length=20, default='default')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Timestamps
    scheduled_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    # Tracking
    email_provider_id = models.CharField(max_length=200, blank=True)
    error_message = models.TextField(blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'payment_reminders'
        ordering = ['-scheduled_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_at']),
            models.Index(fields=['payment', 'status']),
        ]

    def __str__(self):
        return f"Reminder to {self.recipient_email} - {self.status}"

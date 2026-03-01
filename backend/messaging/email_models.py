"""
Email System Models
Automated email campaigns and templates
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class EmailTemplate(models.Model):
    """Email templates for automated campaigns"""

    TEMPLATE_TYPES = [
        ('welcome', 'Welcome Email'),
        ('payment_reminder', 'Payment Reminder'),
        ('class_reminder', 'Class Reminder'),
        ('course_complete', 'Course Completion'),
        ('assignment_due', 'Assignment Due'),
        ('newsletter', 'Newsletter'),
        ('custom', 'Custom Template'),
    ]

    name = models.CharField(max_length=255)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES)
    subject = models.CharField(max_length=255)

    # Email content (supports HTML)
    html_content = models.TextField(help_text="HTML email body")
    text_content = models.TextField(blank=True, help_text="Plain text version")

    # Template variables (JSON)
    variables = models.JSONField(default=dict, blank=True, help_text="Available variables: {{student_name}}, {{course_name}}, etc.")

    # Settings
    is_active = models.BooleanField(default=True)
    from_email = models.EmailField(blank=True, help_text="Leave blank to use default")
    from_name = models.CharField(max_length=255, blank=True, help_text="Sender name")

    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()})"


class EmailCampaign(models.Model):
    """Email campaign/broadcast"""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('paused', 'Paused'),
        ('failed', 'Failed'),
    ]

    RECIPIENT_TYPES = [
        ('all_students', 'All Students'),
        ('all_teachers', 'All Teachers'),
        ('all_users', 'All Users'),
        ('specific_course', 'Specific Course'),
        ('specific_group', 'Specific Group'),
        ('custom_list', 'Custom List'),
    ]

    name = models.CharField(max_length=255)
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    # Override template if needed
    subject = models.CharField(max_length=255)
    html_content = models.TextField()
    text_content = models.TextField(blank=True)

    # Recipients
    recipient_type = models.CharField(max_length=50, choices=RECIPIENT_TYPES)
    specific_course = models.ForeignKey('student_profile.Course', on_delete=models.SET_NULL, null=True, blank=True)
    specific_group = models.ForeignKey('student_profile.Group', on_delete=models.SET_NULL, null=True, blank=True)
    custom_recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='email_campaigns')

    # Scheduling
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_for = models.DateTimeField(null=True, blank=True, help_text="Leave blank to send immediately")
    sent_at = models.DateTimeField(null=True, blank=True)

    # Statistics
    total_recipients = models.PositiveIntegerField(default=0)
    emails_sent = models.PositiveIntegerField(default=0)
    emails_failed = models.PositiveIntegerField(default=0)
    emails_opened = models.PositiveIntegerField(default=0)
    emails_clicked = models.PositiveIntegerField(default=0)

    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_campaigns')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.get_status_display()}"


class EmailLog(models.Model):
    """Individual email send log"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('bounced', 'Bounced'),
        ('failed', 'Failed'),
    ]

    campaign = models.ForeignKey(EmailCampaign, on_delete=models.CASCADE, related_name='logs', null=True, blank=True)
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True, blank=True)

    # Recipient
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    recipient_email = models.EmailField()

    # Email details
    subject = models.CharField(max_length=255)

    # Delivery status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)

    # Error tracking
    error_message = models.TextField(blank=True)

    # External service tracking
    external_id = models.CharField(max_length=255, blank=True, help_text="SendGrid/SES message ID")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['campaign', 'status']),
            models.Index(fields=['recipient', 'created_at']),
        ]

    def __str__(self):
        return f"{self.recipient_email} - {self.subject} ({self.get_status_display()})"


class AutomatedEmail(models.Model):
    """Automated email triggers based on events"""

    TRIGGER_TYPES = [
        ('student_enrolled', 'Student Enrolled in Course'),
        ('payment_due', 'Payment Due Date Approaching'),
        ('payment_overdue', 'Payment Overdue'),
        ('class_reminder', 'Class Starting Soon'),
        ('assignment_due', 'Assignment Due Soon'),
        ('course_completed', 'Course Completed'),
        ('inactivity', 'Student Inactive'),
        ('birthday', 'Birthday'),
    ]

    name = models.CharField(max_length=255)
    trigger_type = models.CharField(max_length=50, choices=TRIGGER_TYPES)
    template = models.ForeignKey(EmailTemplate, on_delete=models.CASCADE)

    # Trigger settings
    is_active = models.BooleanField(default=True)
    trigger_delay_minutes = models.PositiveIntegerField(default=0, help_text="Delay after trigger event (0 = immediate)")

    # Conditions (JSON)
    conditions = models.JSONField(default=dict, blank=True, help_text="Additional conditions for triggering")

    # Statistics
    times_triggered = models.PositiveIntegerField(default=0)
    last_triggered = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_trigger_type_display()})"

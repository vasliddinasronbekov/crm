"""
CRM Activity Timeline Models
Track all interactions with leads and students
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class Activity(models.Model):
    """Track all interactions with leads"""

    ACTIVITY_TYPES = [
        ('call', 'Phone Call'),
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('meeting', 'Meeting'),
        ('note', 'Note'),
        ('task', 'Task'),
        ('status_change', 'Status Change'),
        ('assigned', 'Lead Assigned'),
    ]

    PRIORITY_LEVELS = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    # Related lead
    lead = models.ForeignKey('crm.Lead', on_delete=models.CASCADE, related_name='activities')

    # Activity details
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    subject = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Task-specific fields
    due_date = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_LEVELS, default='normal')

    # Metadata
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_activities')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_activities')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Activities'

    def __str__(self):
        return f"{self.get_activity_type_display()} - {self.lead.full_name} - {self.subject}"

    def mark_complete(self):
        """Mark activity as completed"""
        self.completed = True
        self.completed_at = timezone.now()
        self.save()


class Pipeline(models.Model):
    """Sales pipeline/funnel configuration"""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} ({'Default' if self.is_default else 'Custom'})"


class PipelineStage(models.Model):
    """Stages in a sales pipeline"""

    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name='stages')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    # Stage probability (for forecasting)
    probability = models.FloatField(default=0.0, help_text="Win probability percentage (0-100)")

    # Visual customization
    color = models.CharField(max_length=7, default='#4493f8')  # Hex color

    # Settings
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['pipeline', 'order']
        unique_together = ['pipeline', 'name']

    def __str__(self):
        return f"{self.pipeline.name} - {self.name}"


class Deal(models.Model):
    """Deal/Opportunity - enhanced Lead tracking"""

    # Link to lead
    lead = models.OneToOneField('crm.Lead', on_delete=models.CASCADE, related_name='deal')

    # Pipeline tracking
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE)
    stage = models.ForeignKey(PipelineStage, on_delete=models.CASCADE)

    # Deal value
    value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Expected revenue")
    currency = models.CharField(max_length=3, default='UZS')

    # Forecasting
    expected_close_date = models.DateField(null=True, blank=True)
    probability = models.FloatField(default=0.0, help_text="Custom probability (overrides stage default)")
    weighted_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Outcome
    closed_at = models.DateTimeField(null=True, blank=True)
    won = models.BooleanField(default=False)
    lost_reason = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Deal - {self.lead.full_name} - {self.value} {self.currency}"

    def save(self, *args, **kwargs):
        """Auto-calculate weighted value"""
        # Use custom probability if set, otherwise use stage probability
        prob = self.probability if self.probability > 0 else self.stage.probability
        self.weighted_value = float(self.value) * (prob / 100)
        super().save(*args, **kwargs)

    def move_to_stage(self, new_stage):
        """Move deal to a new stage"""
        old_stage = self.stage
        self.stage = new_stage

        # Update probability if not custom
        if self.probability == 0:
            self.probability = new_stage.probability

        self.save()

        # Log activity
        Activity.objects.create(
            lead=self.lead,
            activity_type='status_change',
            subject=f'Moved from {old_stage.name} to {new_stage.name}',
            description=f'Deal stage changed in pipeline'
        )

    def mark_won(self):
        """Mark deal as won"""
        self.won = True
        self.closed_at = timezone.now()
        self.save()

        # Update lead status
        self.lead.status = 'converted'
        self.lead.save()

    def mark_lost(self, reason=''):
        """Mark deal as lost"""
        self.won = False
        self.closed_at = timezone.now()
        self.lost_reason = reason
        self.save()

        # Update lead status
        self.lead.status = 'rejected'
        self.lead.save()

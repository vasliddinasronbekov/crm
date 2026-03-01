"""
Dunning Management Models

Track failed payment recovery attempts and subscription dunning
"""

from django.db import models
from django.utils import timezone
from .models import UserSubscription, Payment


class DunningAttempt(models.Model):
    """
    Track dunning attempts for failed subscription payments
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('recovered', 'Recovered'),
        ('failed', 'Failed'),
    ]

    # Subscription & Payment
    subscription = models.ForeignKey(
        UserSubscription,
        on_delete=models.CASCADE,
        related_name='dunning_attempts'
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dunning_attempts'
    )

    # Attempt Info
    attempt_number = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Retry Scheduling
    next_retry_at = models.DateTimeField(null=True, blank=True)
    attempted_at = models.DateTimeField(null=True, blank=True)

    # Results
    failure_reason = models.TextField(blank=True)
    recovered_at = models.DateTimeField(null=True, blank=True)

    # Notifications
    notifications_sent = models.JSONField(
        default=list,
        help_text="Log of notifications sent to user"
    )

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['subscription', '-created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]

    def __str__(self):
        return f"Dunning Attempt #{self.attempt_number} for {self.subscription}"


class SubscriptionPauseRecord(models.Model):
    """
    Track subscription pauses (grace period before cancellation)
    """
    subscription = models.ForeignKey(
        UserSubscription,
        on_delete=models.CASCADE,
        related_name='pause_records'
    )

    # Pause Details
    paused_at = models.DateTimeField(auto_now_add=True)
    resumed_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)

    # Reason
    pause_reason = models.CharField(max_length=200, blank=True)
    pause_type = models.CharField(
        max_length=50,
        choices=[
            ('payment_failure', 'Payment Failure'),
            ('user_request', 'User Request'),
            ('admin_action', 'Admin Action'),
        ],
        default='payment_failure'
    )

    # Grace Period
    grace_period_end = models.DateTimeField(
        help_text="Subscription will be canceled if not resolved by this date"
    )

    # Metadata
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-paused_at']
        indexes = [
            models.Index(fields=['subscription', '-paused_at']),
            models.Index(fields=['grace_period_end']),
        ]

    def __str__(self):
        return f"Pause for {self.subscription} ({self.pause_type})"

    @property
    def is_in_grace_period(self):
        """Check if still in grace period"""
        return timezone.now() < self.grace_period_end and not self.resumed_at and not self.canceled_at

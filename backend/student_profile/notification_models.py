"""
Notification and Inbox System
Real-time notifications for exam workflow
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class NotificationType(models.TextChoices):
    EXAM_SUBMITTED = 'exam_submitted', 'Exam Submitted for Review'
    AI_REVIEW_COMPLETE = 'ai_review_complete', 'AI Review Complete'
    EXAM_APPROVED = 'exam_approved', 'Exam Approved'
    EXAM_REJECTED = 'exam_rejected', 'Exam Rejected'
    EXAM_PUBLISHED = 'exam_published', 'Exam Published'
    APPROVAL_REQUEST = 'approval_request', 'Approval Request'
    GENERAL = 'general', 'General Notification'


class Notification(models.Model):
    """
    User notifications for inbox
    """
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )

    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL
    )

    title = models.CharField(max_length=255)
    message = models.TextField()

    # Related objects
    exam_draft = models.ForeignKey(
        'IELTSExamDraft',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )

    # Link to detailed page
    action_url = models.CharField(max_length=500, blank=True)
    action_label = models.CharField(max_length=100, blank=True)

    # Metadata
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.recipient.username}"

    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()

    @classmethod
    def create_ai_review_complete(cls, exam_draft):
        """Notify creator that AI review is complete"""
        return cls.objects.create(
            recipient=exam_draft.created_by,
            notification_type=NotificationType.AI_REVIEW_COMPLETE,
            title='AI Review Complete',
            message=f'AI has finished reviewing your exam "{exam_draft.title}". '
                    f'Quality score: {exam_draft.ai_quality_score}/100. '
                    f'You can now submit it for approval.',
            exam_draft=exam_draft,
            action_url=f'/exams/drafts/{exam_draft.id}',
            action_label='View AI Suggestions'
        )

    @classmethod
    def create_exam_approval_request(cls, exam_draft):
        """Notify LMS heads about new approval request"""
        from users.models import User

        # Get all LMS heads/admins
        lms_heads = User.objects.filter(
            models.Q(is_staff=True) | models.Q(is_superuser=True)
        )

        notifications = []
        for lms_head in lms_heads:
            notif = cls.objects.create(
                recipient=lms_head,
                notification_type=NotificationType.APPROVAL_REQUEST,
                title='New Exam Approval Request',
                message=f'{exam_draft.created_by.get_full_name()} submitted '
                        f'"{exam_draft.title}" for approval. '
                        f'AI Quality Score: {exam_draft.ai_quality_score}/100',
                exam_draft=exam_draft,
                action_url=f'/exams/review/{exam_draft.id}',
                action_label='Review Exam'
            )
            notifications.append(notif)

        return notifications

    @classmethod
    def create_exam_approved(cls, exam_draft):
        """Notify creator that exam was approved"""
        return cls.objects.create(
            recipient=exam_draft.created_by,
            notification_type=NotificationType.EXAM_APPROVED,
            title='Exam Approved!',
            message=f'Your exam "{exam_draft.title}" has been approved by '
                    f'{exam_draft.reviewed_by.get_full_name()}. '
                    f'Review comments: {exam_draft.review_comments or "No comments"}',
            exam_draft=exam_draft,
            action_url=f'/exams/drafts/{exam_draft.id}',
            action_label='View Details'
        )

    @classmethod
    def create_exam_rejected(cls, exam_draft):
        """Notify creator that exam was rejected"""
        return cls.objects.create(
            recipient=exam_draft.created_by,
            notification_type=NotificationType.EXAM_REJECTED,
            title='Exam Rejected',
            message=f'Your exam "{exam_draft.title}" was rejected by '
                    f'{exam_draft.reviewed_by.get_full_name()}. '
                    f'Reason: {exam_draft.review_comments}',
            exam_draft=exam_draft,
            action_url=f'/exams/drafts/{exam_draft.id}',
            action_label='View Feedback'
        )

    @classmethod
    def create_exam_published(cls, exam_draft):
        """Notify creator that exam was published"""
        return cls.objects.create(
            recipient=exam_draft.created_by,
            notification_type=NotificationType.EXAM_PUBLISHED,
            title='Exam Published!',
            message=f'Your exam "{exam_draft.title}" is now live and available '
                    f'to students. Exam ID: {exam_draft.published_exam.id}',
            exam_draft=exam_draft,
            action_url=f'/exams/{exam_draft.published_exam.id}',
            action_label='View Published Exam'
        )


class InboxSettings(models.Model):
    """
    User preferences for notifications
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inbox_settings'
    )

    # Email notifications
    email_on_approval_request = models.BooleanField(default=True)
    email_on_exam_approved = models.BooleanField(default=True)
    email_on_exam_rejected = models.BooleanField(default=True)
    email_on_ai_review = models.BooleanField(default=False)

    # Push notifications (future)
    push_enabled = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Inbox settings for {self.user.username}"

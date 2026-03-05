"""
Social Learning Models

Features:
- Forums & Discussion Boards
- Study Groups
- Social Feed (Activity Stream)
- Peer Messaging
"""

from django.db import models
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from users.models import User
from student_profile.models import Course


# ==================== Forums & Discussions ====================

class ForumCategory(models.Model):
    """Forum category for organizing forums"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Icon name (e.g., 'book', 'code')")
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Forum Categories"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    @property
    def forum_count(self) -> int:
        return self.forums.filter(is_active=True).count()

    @property
    def total_topics(self) -> int:
        return ForumTopic.objects.filter(forum__category=self, is_published=True).count()


class Forum(models.Model):
    """Discussion forum for a course or general topic"""
    category = models.ForeignKey(ForumCategory, on_delete=models.CASCADE, related_name='forums')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='forums',
                               help_text="If linked to a course, only course members can access")

    name = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.CharField(max_length=50, blank=True)

    # Permissions
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True, help_text="If false, requires course enrollment")
    allow_anonymous_viewing = models.BooleanField(default=True)
    moderators = models.ManyToManyField(User, related_name='moderated_forums', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.category.name} - {self.name}"

    @property
    def topic_count(self) -> int:
        return self.topics.filter(is_published=True).count()

    @property
    def post_count(self) -> int:
        return ForumPost.objects.filter(topic__forum=self).count()

    @property
    def last_post(self):
        return ForumPost.objects.filter(topic__forum=self).order_by('-created_at').first()


class ForumTopic(models.Model):
    """Discussion topic within a forum"""
    forum = models.ForeignKey(Forum, on_delete=models.CASCADE, related_name='topics')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_topics')

    title = models.CharField(max_length=300)
    content = models.TextField()

    # Status
    is_published = models.BooleanField(default=True)
    is_pinned = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False, help_text="Locked topics cannot receive new replies")
    is_resolved = models.BooleanField(default=False, help_text="For Q&A topics")

    # Engagement
    views = models.IntegerField(default=0)
    upvotes = models.ManyToManyField(User, related_name='upvoted_topics', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-last_activity_at']

    def __str__(self):
        return self.title

    @property
    def reply_count(self) -> int:
        return self.posts.count()

    @property
    def upvote_count(self) -> int:
        return self.upvotes.count()

    @property
    def last_post(self):
        return self.posts.order_by('-created_at').first()

    def increment_views(self):
        """Thread-safe view increment"""
        ForumTopic.objects.filter(pk=self.pk).update(views=models.F('views') + 1)


class ForumPost(models.Model):
    """Reply to a forum topic"""
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_posts')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies',
                               help_text="For nested replies")

    content = models.TextField()

    # Status
    is_published = models.BooleanField(default=True)
    is_answer = models.BooleanField(default=False, help_text="Mark as accepted answer")
    is_edited = models.BooleanField(default=False)

    # Engagement
    upvotes = models.ManyToManyField(User, related_name='upvoted_posts', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Post by {self.author.get_full_name()} in {self.topic.title}"

    @property
    def upvote_count(self) -> int:
        return self.upvotes.count()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update topic's last activity
        self.topic.last_activity_at = timezone.now()
        self.topic.save(update_fields=['last_activity_at'])


# ==================== Study Groups ====================

class StudyGroup(models.Model):
    """Student study group"""
    name = models.CharField(max_length=200)
    description = models.TextField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='study_groups', null=True, blank=True)

    # Settings
    avatar = models.URLField(blank=True)
    is_public = models.BooleanField(default=True, help_text="Public groups are discoverable")
    max_members = models.IntegerField(default=50, help_text="Maximum number of members")
    require_approval = models.BooleanField(default=False, help_text="Admin must approve join requests")

    # Members
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_study_groups')
    admins = models.ManyToManyField(User, related_name='admin_study_groups', blank=True)
    members = models.ManyToManyField(User, through='StudyGroupMembership', related_name='study_groups')

    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def member_count(self) -> int:
        return self.members.filter(studygroupmembership__status='active').count()

    @property
    def is_full(self) -> bool:
        return self.member_count >= self.max_members

    def can_join(self, user):
        """Check if user can join the group"""
        if self.is_full:
            return False, "Group is full"
        if self.members.filter(id=user.id).exists():
            return False, "Already a member"
        return True, "Can join"


class StudyGroupMembership(models.Model):
    """Study group membership"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('banned', 'Banned'),
    ]

    ROLE_CHOICES = [
        ('member', 'Member'),
        ('moderator', 'Moderator'),
        ('admin', 'Admin'),
    ]

    group = models.ForeignKey(StudyGroup, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')

    joined_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['group', 'user']
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.user.get_full_name()} in {self.group.name}"


class StudyGroupPost(models.Model):
    """Post in a study group"""
    group = models.ForeignKey(StudyGroup, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_group_posts')

    content = models.TextField()
    attachments = models.JSONField(default=list, blank=True, help_text="List of file URLs")

    # Engagement
    likes = models.ManyToManyField(User, related_name='liked_group_posts', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Post by {self.author.get_full_name()} in {self.group.name}"

    @property
    def like_count(self) -> int:
        return self.likes.count()

    @property
    def comment_count(self):
        return self.comments.count()


class StudyGroupComment(models.Model):
    """Comment on a study group post"""
    post = models.ForeignKey(StudyGroupPost, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_group_comments')

    content = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.get_full_name()}"


# ==================== Social Feed ====================

class FeedItem(models.Model):
    """Activity feed item (generic for all social activities)"""
    ACTIVITY_TYPES = [
        ('topic_created', 'Created Forum Topic'),
        ('post_created', 'Replied to Topic'),
        ('group_joined', 'Joined Study Group'),
        ('group_post', 'Posted in Study Group'),
        ('achievement', 'Earned Achievement'),
        ('course_completed', 'Completed Course'),
        ('quiz_passed', 'Passed Quiz'),
        ('level_up', 'Leveled Up'),
        ('badge_earned', 'Earned Badge'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feed_items')
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)

    # Generic relation to any object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    # Activity data
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    # Engagement
    likes = models.ManyToManyField(User, related_name='liked_feed_items', blank=True)

    # Visibility
    is_public = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_activity_type_display()}"

    @property
    def like_count(self) -> int:
        return self.likes.count()


class FeedComment(models.Model):
    """Comment on a feed item"""
    feed_item = models.ForeignKey(FeedItem, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feed_comments')

    content = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.get_full_name()}"


# ==================== Peer Messaging ====================

class Conversation(models.Model):
    """Direct message conversation between users"""
    CONVERSATION_TYPES = [
        ('direct', 'Direct Message'),
        ('group', 'Group Chat'),
    ]

    conversation_type = models.CharField(max_length=20, choices=CONVERSATION_TYPES, default='direct')
    participants = models.ManyToManyField(User, related_name='social_conversations')

    # For group chats
    title = models.CharField(max_length=200, blank=True)
    creator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='social_created_conversations')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        if self.conversation_type == 'group':
            return self.title or f"Group Chat ({self.participants.count()} members)"
        else:
            participants = list(self.participants.all()[:2])
            return f"DM: {' & '.join([p.get_full_name() for p in participants])}"

    @property
    def last_message(self):
        return self.social_messages.order_by('-created_at').first()

    def get_unread_count(self, user):
        """Get unread message count for a specific user"""
        return self.social_messages.exclude(sender=user).filter(
            social_read_receipts__user=user,
            social_read_receipts__is_read=False
        ).count()


class Message(models.Model):
    """Message in a conversation"""
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='social_messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_sent_messages')

    content = models.TextField()
    attachments = models.JSONField(default=list, blank=True)

    # Reply to another message (for threading)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='social_replies')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_edited = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.get_full_name()} at {self.created_at}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update conversation's updated_at
        self.conversation.updated_at = timezone.now()
        self.conversation.save(update_fields=['updated_at'])


class MessageReadReceipt(models.Model):
    """Track which messages have been read by which users"""
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='social_read_receipts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_message_read_receipts')

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['message', 'user']

    def __str__(self):
        status = "Read" if self.is_read else "Unread"
        return f"{status} by {self.user.get_full_name()}"

    def mark_as_read(self):
        """Mark message as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()


# ==================== Notifications ====================

class SocialNotification(models.Model):
    """Notifications for social activities"""
    NOTIFICATION_TYPES = [
        ('topic_reply', 'Someone replied to your topic'),
        ('post_mention', 'You were mentioned in a post'),
        ('post_upvote', 'Your post was upvoted'),
        ('group_invite', 'You were invited to a study group'),
        ('group_request', 'Someone requested to join your group'),
        ('group_post', 'New post in your study group'),
        ('message_received', 'New message received'),
        ('feed_comment', 'Someone commented on your activity'),
        ('feed_like', 'Someone liked your activity'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_notifications')
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)

    # Generic relation to the source object
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # Notification data
    title = models.CharField(max_length=300)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)

    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"{self.get_notification_type_display()} for {self.user.get_full_name()}"

    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()

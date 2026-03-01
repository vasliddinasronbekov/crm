"""
Social Learning Signals

Automatically create feed items and notifications for social activities
"""
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import (
    ForumTopic, ForumPost,
    StudyGroup, StudyGroupMembership, StudyGroupPost,
    FeedItem, SocialNotification
)


# ==================== Forum Signals ====================

@receiver(post_save, sender=ForumTopic)
def create_topic_feed_item(sender, instance, created, **kwargs):
    """Create feed item when user creates a forum topic"""
    if created and instance.is_published:
        FeedItem.objects.create(
            user=instance.author,
            activity_type='topic_created',
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id,
            title=f"Created a new topic: {instance.title}",
            description=instance.content[:200] + '...' if len(instance.content) > 200 else instance.content,
            metadata={
                'forum_id': instance.forum.id,
                'forum_name': instance.forum.name,
                'topic_id': instance.id
            }
        )


@receiver(post_save, sender=ForumPost)
def create_post_feed_item(sender, instance, created, **kwargs):
    """Create feed item and notification when user replies to a topic"""
    if created and instance.is_published:
        # Create feed item
        FeedItem.objects.create(
            user=instance.author,
            activity_type='post_created',
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id,
            title=f"Replied to: {instance.topic.title}",
            description=instance.content[:200] + '...' if len(instance.content) > 200 else instance.content,
            metadata={
                'topic_id': instance.topic.id,
                'topic_title': instance.topic.title,
                'post_id': instance.id
            }
        )

        # Notify topic author if it's not their own reply
        if instance.author != instance.topic.author:
            SocialNotification.objects.create(
                user=instance.topic.author,
                notification_type='topic_reply',
                content_type=ContentType.objects.get_for_model(instance),
                object_id=instance.id,
                title='New reply to your topic',
                message=f"{instance.author.get_full_name()} replied to your topic: {instance.topic.title}",
                link=f"/forums/topics/{instance.topic.id}"
            )


# ==================== Study Group Signals ====================

@receiver(post_save, sender=StudyGroupMembership)
def handle_study_group_membership(sender, instance, created, **kwargs):
    """Create feed item when user joins a study group"""
    if created and instance.status == 'active':
        # Create feed item
        FeedItem.objects.create(
            user=instance.user,
            activity_type='group_joined',
            content_type=ContentType.objects.get_for_model(instance.group),
            object_id=instance.group.id,
            title=f"Joined study group: {instance.group.name}",
            description=instance.group.description[:200] if instance.group.description else '',
            metadata={
                'group_id': instance.group.id,
                'group_name': instance.group.name
            }
        )

        # Notify group admins (if user requested to join)
        if instance.group.require_approval and instance.status == 'pending':
            for admin in instance.group.admins.all():
                SocialNotification.objects.create(
                    user=admin,
                    notification_type='group_request',
                    content_type=ContentType.objects.get_for_model(instance),
                    object_id=instance.id,
                    title='New group join request',
                    message=f"{instance.user.get_full_name()} requested to join {instance.group.name}",
                    link=f"/study-groups/{instance.group.id}"
                )


@receiver(post_save, sender=StudyGroupPost)
def create_group_post_feed_item(sender, instance, created, **kwargs):
    """Create feed item and notifications when user posts in a study group"""
    if created:
        # Create feed item
        FeedItem.objects.create(
            user=instance.author,
            activity_type='group_post',
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id,
            title=f"Posted in {instance.group.name}",
            description=instance.content[:200] + '...' if len(instance.content) > 200 else instance.content,
            metadata={
                'group_id': instance.group.id,
                'group_name': instance.group.name,
                'post_id': instance.id
            }
        )

        # Notify all group members except the author
        members = instance.group.members.exclude(id=instance.author.id)
        for member in members:
            # Only notify active members
            if instance.group.studygroupmembership_set.filter(user=member, status='active').exists():
                SocialNotification.objects.create(
                    user=member,
                    notification_type='group_post',
                    content_type=ContentType.objects.get_for_model(instance),
                    object_id=instance.id,
                    title=f'New post in {instance.group.name}',
                    message=f"{instance.author.get_full_name()} posted in {instance.group.name}",
                    link=f"/study-groups/{instance.group.id}"
                )


# ==================== Integration with Other Apps ====================

def create_achievement_feed_item(user, achievement_name, description="", metadata=None):
    """
    Helper function to create feed item for achievements
    Can be called from gamification app
    """
    FeedItem.objects.create(
        user=user,
        activity_type='achievement',
        title=f"Earned achievement: {achievement_name}",
        description=description,
        metadata=metadata or {},
        is_public=True
    )


def create_course_completion_feed_item(user, course_name, course_id, metadata=None):
    """
    Helper function to create feed item for course completion
    Can be called from LMS app
    """
    FeedItem.objects.create(
        user=user,
        activity_type='course_completed',
        title=f"Completed course: {course_name}",
        description=f"Successfully completed {course_name}",
        metadata=metadata or {'course_id': course_id},
        is_public=True
    )


def create_level_up_feed_item(user, level, metadata=None):
    """
    Helper function to create feed item for level ups
    Can be called from gamification app
    """
    FeedItem.objects.create(
        user=user,
        activity_type='level_up',
        title=f"Reached Level {level}!",
        description=f"Leveled up to Level {level}",
        metadata=metadata or {'level': level},
        is_public=True
    )


def create_badge_earned_feed_item(user, badge_name, badge_icon="", metadata=None):
    """
    Helper function to create feed item for badge awards
    Can be called from gamification app
    """
    FeedItem.objects.create(
        user=user,
        activity_type='badge_earned',
        title=f"Earned badge: {badge_name}",
        description=f"Unlocked the {badge_name} badge!",
        metadata=metadata or {'badge_name': badge_name, 'icon': badge_icon},
        is_public=True
    )


def create_quiz_passed_feed_item(user, quiz_name, score, metadata=None):
    """
    Helper function to create feed item for quiz completion
    Can be called from LMS app
    """
    FeedItem.objects.create(
        user=user,
        activity_type='quiz_passed',
        title=f"Passed quiz: {quiz_name}",
        description=f"Scored {score}% on {quiz_name}",
        metadata=metadata or {'quiz_name': quiz_name, 'score': score},
        is_public=True
    )

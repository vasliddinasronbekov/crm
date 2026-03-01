"""
Social Learning Serializers
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    ForumCategory, Forum, ForumTopic, ForumPost,
    StudyGroup, StudyGroupMembership, StudyGroupPost, StudyGroupComment,
    FeedItem, FeedComment,
    Conversation, Message, MessageReadReceipt,
    SocialNotification
)

User = get_user_model()


# ==================== User Serializer ====================

class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for nested serialization"""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'avatar']

    def get_avatar(self, obj):
        # Return avatar URL or generate initials-based avatar
        return f"https://ui-avatars.com/api/?name={obj.get_full_name()}&background=random"


# ==================== Forums Serializers ====================

class ForumCategorySerializer(serializers.ModelSerializer):
    forum_count = serializers.ReadOnlyField()
    total_topics = serializers.ReadOnlyField()

    class Meta:
        model = ForumCategory
        fields = ['id', 'name', 'description', 'icon', 'order', 'is_active',
                  'forum_count', 'total_topics', 'created_at']


class ForumListSerializer(serializers.ModelSerializer):
    """For listing forums"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    topic_count = serializers.ReadOnlyField()
    post_count = serializers.ReadOnlyField()
    last_post = serializers.SerializerMethodField()

    class Meta:
        model = Forum
        fields = ['id', 'name', 'description', 'icon', 'category', 'category_name',
                  'course', 'is_public', 'topic_count', 'post_count', 'last_post', 'created_at']

    def get_last_post(self, obj):
        last_post = obj.last_post
        if last_post:
            return {
                'id': last_post.id,
                'author': UserBasicSerializer(last_post.author).data,
                'created_at': last_post.created_at
            }
        return None


class ForumDetailSerializer(ForumListSerializer):
    """For forum detail view"""
    moderators = UserBasicSerializer(many=True, read_only=True)

    class Meta(ForumListSerializer.Meta):
        fields = ForumListSerializer.Meta.fields + ['moderators', 'allow_anonymous_viewing', 'updated_at']


class ForumPostSerializer(serializers.ModelSerializer):
    """For forum post replies"""
    author = UserBasicSerializer(read_only=True)
    upvote_count = serializers.ReadOnlyField()
    is_upvoted = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = ['id', 'content', 'author', 'parent', 'is_published', 'is_answer',
                  'is_edited', 'upvote_count', 'is_upvoted', 'replies', 'created_at', 'updated_at']
        read_only_fields = ['author', 'is_edited']

    def get_is_upvoted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.upvotes.filter(id=request.user.id).exists()
        return False

    def get_replies(self, obj):
        # Get direct replies only (not nested beyond 1 level)
        replies = obj.replies.filter(is_published=True)
        return ForumPostSerializer(replies, many=True, context=self.context).data


class ForumTopicListSerializer(serializers.ModelSerializer):
    """For listing topics"""
    author = UserBasicSerializer(read_only=True)
    forum_name = serializers.CharField(source='forum.name', read_only=True)
    reply_count = serializers.ReadOnlyField()
    upvote_count = serializers.ReadOnlyField()
    last_post = serializers.SerializerMethodField()

    class Meta:
        model = ForumTopic
        fields = ['id', 'title', 'author', 'forum', 'forum_name', 'is_pinned',
                  'is_locked', 'is_resolved', 'views', 'reply_count', 'upvote_count',
                  'last_post', 'created_at', 'last_activity_at']

    def get_last_post(self, obj):
        last_post = obj.last_post
        if last_post:
            return {
                'author': UserBasicSerializer(last_post.author).data,
                'created_at': last_post.created_at
            }
        return None


class ForumTopicDetailSerializer(ForumTopicListSerializer):
    """For topic detail view with posts"""
    posts = ForumPostSerializer(many=True, read_only=True)
    is_upvoted = serializers.SerializerMethodField()

    class Meta(ForumTopicListSerializer.Meta):
        fields = ForumTopicListSerializer.Meta.fields + ['content', 'posts', 'is_upvoted', 'updated_at']

    def get_is_upvoted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.upvotes.filter(id=request.user.id).exists()
        return False


class ForumTopicCreateSerializer(serializers.ModelSerializer):
    """For creating new topics"""
    class Meta:
        model = ForumTopic
        fields = ['forum', 'title', 'content']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)


# ==================== Study Groups Serializers ====================

class StudyGroupMembershipSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = StudyGroupMembership
        fields = ['id', 'user', 'status', 'role', 'joined_at', 'last_active_at']


class StudyGroupListSerializer(serializers.ModelSerializer):
    """For listing study groups"""
    creator = UserBasicSerializer(read_only=True)
    member_count = serializers.ReadOnlyField()
    is_full = serializers.ReadOnlyField()
    is_member = serializers.SerializerMethodField()
    course_name = serializers.CharField(source='course.name', read_only=True, allow_null=True)

    class Meta:
        model = StudyGroup
        fields = ['id', 'name', 'description', 'avatar', 'course', 'course_name',
                  'creator', 'is_public', 'max_members', 'member_count', 'is_full',
                  'is_member', 'created_at']

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(id=request.user.id, studygroupmembership__status='active').exists()
        return False


class StudyGroupDetailSerializer(StudyGroupListSerializer):
    """For study group detail view"""
    admins = UserBasicSerializer(many=True, read_only=True)
    members = serializers.SerializerMethodField()
    recent_posts = serializers.SerializerMethodField()

    class Meta(StudyGroupListSerializer.Meta):
        fields = StudyGroupListSerializer.Meta.fields + [
            'admins', 'members', 'require_approval', 'recent_posts', 'updated_at'
        ]

    def get_members(self, obj):
        # Only return active members
        memberships = obj.studygroupmembership_set.filter(status='active').select_related('user')
        return StudyGroupMembershipSerializer(memberships, many=True).data

    def get_recent_posts(self, obj):
        # Return last 5 posts
        posts = obj.posts.all()[:5]
        return StudyGroupPostSerializer(posts, many=True, context=self.context).data


class StudyGroupCreateSerializer(serializers.ModelSerializer):
    """For creating study groups"""
    class Meta:
        model = StudyGroup
        fields = ['name', 'description', 'course', 'avatar', 'is_public', 'max_members', 'require_approval']

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['creator'] = user
        group = super().create(validated_data)

        # Add creator as admin member
        StudyGroupMembership.objects.create(
            group=group,
            user=user,
            status='active',
            role='admin'
        )
        group.admins.add(user)

        return group


class StudyGroupCommentSerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)

    class Meta:
        model = StudyGroupComment
        fields = ['id', 'content', 'author', 'created_at', 'updated_at']
        read_only_fields = ['author']


class StudyGroupPostSerializer(serializers.ModelSerializer):
    """For study group posts"""
    author = UserBasicSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()
    comment_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    comments = StudyGroupCommentSerializer(many=True, read_only=True)

    class Meta:
        model = StudyGroupPost
        fields = ['id', 'content', 'attachments', 'author', 'like_count', 'comment_count',
                  'is_liked', 'comments', 'created_at', 'updated_at']
        read_only_fields = ['author']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False


# ==================== Social Feed Serializers ====================

class FeedCommentSerializer(serializers.ModelSerializer):
    author = UserBasicSerializer(read_only=True)

    class Meta:
        model = FeedComment
        fields = ['id', 'content', 'author', 'created_at', 'updated_at']
        read_only_fields = ['author']


class FeedItemSerializer(serializers.ModelSerializer):
    """Social feed item"""
    user = UserBasicSerializer(read_only=True)
    like_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    comments = FeedCommentSerializer(many=True, read_only=True)
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = FeedItem
        fields = ['id', 'user', 'activity_type', 'title', 'description', 'metadata',
                  'like_count', 'is_liked', 'comments', 'comment_count', 'is_public', 'created_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_comment_count(self, obj):
        return obj.comments.count()


# ==================== Messaging Serializers ====================

class MessageSerializer(serializers.ModelSerializer):
    """For messages in conversations"""
    sender = UserBasicSerializer(read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'content', 'attachments', 'sender', 'reply_to', 'is_edited',
                  'is_read', 'created_at', 'updated_at']
        read_only_fields = ['sender', 'is_edited']

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                receipt = obj.social_read_receipts.get(user=request.user)
                return receipt.is_read
            except MessageReadReceipt.DoesNotExist:
                return False
        return False


class ConversationListSerializer(serializers.ModelSerializer):
    """For listing conversations"""
    participants = UserBasicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'conversation_type', 'title', 'participants', 'last_message',
                  'unread_count', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        last_msg = obj.last_message
        if last_msg:
            return {
                'content': last_msg.content[:50] + '...' if len(last_msg.content) > 50 else last_msg.content,
                'sender': UserBasicSerializer(last_msg.sender).data,
                'created_at': last_msg.created_at
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.get_unread_count(request.user)
        return 0


class ConversationDetailSerializer(ConversationListSerializer):
    """For conversation detail with messages"""
    messages = MessageSerializer(many=True, read_only=True, source='social_messages')

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ['messages']


class ConversationCreateSerializer(serializers.ModelSerializer):
    """For creating conversations"""
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True
    )

    class Meta:
        model = Conversation
        fields = ['conversation_type', 'title', 'participant_ids']

    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids')
        user = self.context['request'].user

        conversation = Conversation.objects.create(
            conversation_type=validated_data.get('conversation_type', 'direct'),
            title=validated_data.get('title', ''),
            creator=user
        )

        # Add participants
        conversation.participants.add(user)
        for user_id in participant_ids:
            try:
                participant = User.objects.get(id=user_id)
                conversation.participants.add(participant)
            except User.DoesNotExist:
                pass

        return conversation


# ==================== Notifications Serializer ====================

class SocialNotificationSerializer(serializers.ModelSerializer):
    """Social notifications"""
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = SocialNotification
        fields = ['id', 'notification_type', 'notification_type_display', 'title',
                  'message', 'link', 'is_read', 'read_at', 'created_at']
        read_only_fields = ['notification_type', 'title', 'message', 'link', 'read_at']

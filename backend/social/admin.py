"""
Social Learning Django Admin
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    ForumCategory, Forum, ForumTopic, ForumPost,
    StudyGroup, StudyGroupMembership, StudyGroupPost, StudyGroupComment,
    FeedItem, FeedComment,
    Conversation, Message, MessageReadReceipt,
    SocialNotification
)


# ==================== Forums Admin ====================

@admin.register(ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'order', 'forum_count', 'total_topics', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['order', 'name']


@admin.register(Forum)
class ForumAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'course', 'topic_count', 'post_count', 'is_public', 'is_active', 'created_at']
    list_filter = ['category', 'is_public', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['moderators']
    raw_id_fields = ['course']


@admin.register(ForumTopic)
class ForumTopicAdmin(admin.ModelAdmin):
    list_display = ['title', 'forum', 'author', 'views', 'upvote_count', 'reply_count', 'is_pinned', 'is_locked', 'is_resolved', 'created_at']
    list_filter = ['forum', 'is_pinned', 'is_locked', 'is_resolved', 'created_at']
    search_fields = ['title', 'content', 'author__first_name', 'author__last_name']
    readonly_fields = ['views', 'upvote_count', 'reply_count', 'created_at', 'updated_at']
    raw_id_fields = ['author', 'forum']
    date_hierarchy = 'created_at'

    def upvote_count(self, obj):
        return obj.upvote_count
    upvote_count.short_description = 'Upvotes'

    def reply_count(self, obj):
        return obj.reply_count
    reply_count.short_description = 'Replies'


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'topic', 'author', 'upvote_count', 'is_answer', 'is_published', 'created_at']
    list_filter = ['is_published', 'is_answer', 'created_at']
    search_fields = ['content', 'author__first_name', 'author__last_name', 'topic__title']
    readonly_fields = ['upvote_count', 'created_at', 'updated_at']
    raw_id_fields = ['topic', 'author', 'parent']
    date_hierarchy = 'created_at'

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = 'Content'

    def upvote_count(self, obj):
        return obj.upvote_count
    upvote_count.short_description = 'Upvotes'


# ==================== Study Groups Admin ====================

@admin.register(StudyGroup)
class StudyGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'creator', 'course', 'member_count', 'is_public', 'is_full', 'is_active', 'created_at']
    list_filter = ['is_public', 'is_active', 'created_at']
    search_fields = ['name', 'description', 'creator__first_name', 'creator__last_name']
    raw_id_fields = ['creator', 'course']
    filter_horizontal = ['admins']
    readonly_fields = ['member_count', 'is_full', 'created_at', 'updated_at']

    def member_count(self, obj):
        return obj.member_count
    member_count.short_description = 'Members'

    def is_full(self, obj):
        return obj.is_full
    is_full.boolean = True
    is_full.short_description = 'Full'


@admin.register(StudyGroupMembership)
class StudyGroupMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'group', 'status', 'role', 'joined_at']
    list_filter = ['status', 'role', 'joined_at']
    search_fields = ['user__first_name', 'user__last_name', 'group__name']
    raw_id_fields = ['group', 'user']
    date_hierarchy = 'joined_at'


@admin.register(StudyGroupPost)
class StudyGroupPostAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'group', 'author', 'like_count', 'comment_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__first_name', 'author__last_name', 'group__name']
    raw_id_fields = ['group', 'author']
    readonly_fields = ['like_count', 'comment_count', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = 'Content'

    def like_count(self, obj):
        return obj.like_count
    like_count.short_description = 'Likes'

    def comment_count(self, obj):
        return obj.comment_count
    comment_count.short_description = 'Comments'


@admin.register(StudyGroupComment)
class StudyGroupCommentAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'post', 'author', 'created_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__first_name', 'author__last_name']
    raw_id_fields = ['post', 'author']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = 'Content'


# ==================== Social Feed Admin ====================

@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'activity_type', 'like_count', 'is_public', 'created_at']
    list_filter = ['activity_type', 'is_public', 'created_at']
    search_fields = ['title', 'description', 'user__first_name', 'user__last_name']
    raw_id_fields = ['user']
    readonly_fields = ['like_count', 'created_at']
    date_hierarchy = 'created_at'

    def like_count(self, obj):
        return obj.like_count
    like_count.short_description = 'Likes'


@admin.register(FeedComment)
class FeedCommentAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'feed_item', 'author', 'created_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__first_name', 'author__last_name']
    raw_id_fields = ['feed_item', 'author']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = 'Content'


# ==================== Messaging Admin ====================

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'conversation_type', 'participant_count', 'creator', 'created_at', 'updated_at']
    list_filter = ['conversation_type', 'created_at']
    search_fields = ['title']
    filter_horizontal = ['participants']
    raw_id_fields = ['creator']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def participant_count(self, obj):
        return obj.participants.count()
    participant_count.short_description = 'Participants'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'conversation', 'sender', 'is_edited', 'created_at']
    list_filter = ['is_edited', 'created_at']
    search_fields = ['content', 'sender__first_name', 'sender__last_name']
    raw_id_fields = ['conversation', 'sender', 'reply_to']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = 'Content'


@admin.register(MessageReadReceipt)
class MessageReadReceiptAdmin(admin.ModelAdmin):
    list_display = ['message_preview', 'user', 'is_read', 'read_at']
    list_filter = ['is_read', 'read_at']
    search_fields = ['user__first_name', 'user__last_name', 'message__content']
    raw_id_fields = ['message', 'user']
    readonly_fields = ['read_at']

    def message_preview(self, obj):
        content = obj.message.content
        return content[:50] + '...' if len(content) > 50 else content
    message_preview.short_description = 'Message'


# ==================== Notifications Admin ====================

@admin.register(SocialNotification)
class SocialNotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'user__first_name', 'user__last_name']
    raw_id_fields = ['user']
    readonly_fields = ['created_at', 'read_at']
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        # Notifications are created automatically, not manually
        return False

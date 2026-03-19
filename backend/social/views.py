"""
Social Learning Views

ViewSets for all social features:
- Forums & Discussion Boards
- Study Groups
- Social Feed
- Peer Messaging
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404

from users.models import User
from student_profile.models import Group
from .models import (
    ForumCategory, Forum, ForumTopic, ForumPost,
    StudyGroup, StudyGroupMembership, StudyGroupPost, StudyGroupComment,
    FeedItem, FeedComment,
    Conversation, Message, MessageReadReceipt,
    SocialNotification
)
from .serializers import (
    ForumCategorySerializer, ForumListSerializer, ForumDetailSerializer,
    ForumTopicListSerializer, ForumTopicDetailSerializer, ForumTopicCreateSerializer,
    ForumPostSerializer,
    StudyGroupListSerializer, StudyGroupDetailSerializer, StudyGroupCreateSerializer,
    StudyGroupMembershipSerializer, StudyGroupPostSerializer, StudyGroupCommentSerializer,
    FeedItemSerializer, FeedCommentSerializer,
    ConversationListSerializer, ConversationDetailSerializer, ConversationCreateSerializer,
    MessageSerializer, SocialNotificationSerializer
)
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
    user_belongs_to_branch,
)


def _scope_forums_to_active_branch(queryset, request):
    user = request.user
    if not user.is_authenticated:
        return queryset

    active_branch_id = get_effective_branch_id(request, user)
    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    scoped_queryset = queryset.filter(
        Q(course__groups__branch_id=active_branch_id)
        | build_user_branch_q(active_branch_id, 'moderators')
        | build_user_branch_q(active_branch_id, 'topics__author')
        | build_user_branch_q(active_branch_id, 'topics__posts__author')
    ).distinct()
    out_of_scope_users = User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()
    return scoped_queryset.exclude(
        moderators__in=out_of_scope_users
    ).exclude(
        topics__author__in=out_of_scope_users
    ).exclude(
        topics__posts__author__in=out_of_scope_users
    ).distinct()


def _scope_study_groups_to_active_branch(queryset, request):
    user = request.user
    active_branch_id = get_effective_branch_id(request, user)

    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    scoped_queryset = queryset.filter(
        build_user_branch_q(active_branch_id, 'creator')
        | build_user_branch_q(active_branch_id, 'admins')
        | build_user_branch_q(active_branch_id, 'members')
        | Q(course__groups__branch_id=active_branch_id)
    ).distinct()
    out_of_scope_users = User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()
    return scoped_queryset.exclude(
        creator__in=out_of_scope_users
    ).exclude(
        admins__in=out_of_scope_users
    ).exclude(
        members__in=out_of_scope_users
    ).distinct()


# ==================== Forums ViewSets ====================

class ForumCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Forum categories (read-only)"""
    queryset = ForumCategory.objects.filter(is_active=True)
    serializer_class = ForumCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return ForumCategory.objects.none()

        scoped_forums = _scope_forums_to_active_branch(
            Forum.objects.filter(is_active=True),
            self.request,
        )
        return ForumCategory.objects.filter(
            is_active=True,
            forums__in=scoped_forums,
        ).distinct()


class ForumViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Forums
    
    List and retrieve forums
    """
    queryset = Forum.objects.filter(is_active=True).select_related('category', 'course')
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ForumDetailSerializer
        return ForumListSerializer

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Forum.objects.none()

        queryset = _scope_forums_to_active_branch(super().get_queryset(), self.request)

        # Filter by category
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # Filter by course
        course_id = self.request.query_params.get('course')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset


class ForumTopicViewSet(viewsets.ModelViewSet):
    """
    Forum topics
    
    CRUD operations for discussion topics
    """
    queryset = ForumTopic.objects.filter(is_published=True).select_related(
        'forum', 'author'
    ).prefetch_related('upvotes')
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'last_activity_at', 'views', 'upvotes']
    ordering = ['-is_pinned', '-last_activity_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ForumTopicCreateSerializer
        elif self.action == 'retrieve':
            return ForumTopicDetailSerializer
        return ForumTopicListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(
            forum__in=_scope_forums_to_active_branch(
                Forum.objects.filter(is_active=True),
                self.request,
            )
        ).distinct()

        # Filter by forum
        forum_id = self.request.query_params.get('forum')
        if forum_id:
            queryset = queryset.filter(forum_id=forum_id)

        # Filter by author
        author_id = self.request.query_params.get('author')
        if author_id:
            queryset = queryset.filter(author_id=author_id)

        # Filter by resolved status
        is_resolved = self.request.query_params.get('is_resolved')
        if is_resolved is not None:
            queryset = queryset.filter(is_resolved=is_resolved.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        forum = serializer.validated_data['forum']
        if not _scope_forums_to_active_branch(
            Forum.objects.filter(id=forum.id, is_active=True),
            self.request,
        ).exists():
            raise PermissionDenied('You do not have access to this forum.')
        serializer.save(author=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Increment view count
        instance.increment_views()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        """Upvote/un-upvote a topic"""
        topic = self.get_object()

        if request.user in topic.upvotes.all():
            topic.upvotes.remove(request.user)
            return Response({'status': 'upvote removed', 'upvote_count': topic.upvote_count})
        else:
            topic.upvotes.add(request.user)
            return Response({'status': 'upvoted', 'upvote_count': topic.upvote_count})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def lock(self, request, pk=None):
        """Lock topic (moderators only)"""
        topic = self.get_object()

        # Check if user is moderator
        if not (request.user.is_staff or request.user in topic.forum.moderators.all()):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        topic.is_locked = not topic.is_locked
        topic.save()
        return Response({'status': 'locked' if topic.is_locked else 'unlocked'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def resolve(self, request, pk=None):
        """Mark topic as resolved"""
        topic = self.get_object()

        # Only author or moderator can mark as resolved
        if not (request.user == topic.author or request.user.is_staff or request.user in topic.forum.moderators.all()):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        topic.is_resolved = not topic.is_resolved
        topic.save()
        return Response({'status': 'resolved' if topic.is_resolved else 'unresolved'})


class ForumPostViewSet(viewsets.ModelViewSet):
    """
    Forum posts (replies)
    
    CRUD operations for topic replies
    """
    queryset = ForumPost.objects.filter(is_published=True).select_related('topic', 'author')
    serializer_class = ForumPostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            topic__forum__in=_scope_forums_to_active_branch(
                Forum.objects.filter(is_active=True),
                self.request,
            )
        ).distinct()

        # Filter by topic
        topic_id = self.request.query_params.get('topic')
        if topic_id:
            queryset = queryset.filter(topic_id=topic_id)

        return queryset

    def perform_create(self, serializer):
        topic = serializer.validated_data['topic']
        if not _scope_forums_to_active_branch(
            Forum.objects.filter(id=topic.forum_id, is_active=True),
            self.request,
        ).exists():
            raise PermissionDenied('You do not have access to this topic.')
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        """Upvote/un-upvote a post"""
        post = self.get_object()

        if request.user in post.upvotes.all():
            post.upvotes.remove(request.user)
            return Response({'status': 'upvote removed', 'upvote_count': post.upvote_count})
        else:
            post.upvotes.add(request.user)
            return Response({'status': 'upvoted', 'upvote_count': post.upvote_count})

    @action(detail=True, methods=['post'])
    def mark_as_answer(self, request, pk=None):
        """Mark post as accepted answer"""
        post = self.get_object()

        # Only topic author or moderator can mark answer
        if not (request.user == post.topic.author or request.user.is_staff):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        # Unmark other answers in this topic
        ForumPost.objects.filter(topic=post.topic, is_answer=True).update(is_answer=False)

        post.is_answer = True
        post.save()

        # Mark topic as resolved
        post.topic.is_resolved = True
        post.topic.save()

        return Response({'status': 'marked as answer'})


# ==================== Study Groups ViewSets ====================

class StudyGroupViewSet(viewsets.ModelViewSet):
    """
    Study groups
    
    CRUD operations for study groups
    """
    queryset = StudyGroup.objects.filter(is_active=True).select_related('creator', 'course')
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'member_count']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return StudyGroupCreateSerializer
        elif self.action == 'retrieve':
            return StudyGroupDetailSerializer
        return StudyGroupListSerializer

    def get_queryset(self):
        queryset = _scope_study_groups_to_active_branch(
            super().get_queryset(),
            self.request,
        )
        user = self.request.user

        # Filter by visibility
        show_all = self.request.query_params.get('show_all') == 'true'
        if not show_all:
            # Show public groups + groups user is member of
            queryset = queryset.filter(
                Q(is_public=True) | Q(members=user)
            ).distinct()

        # Filter by course
        course_id = self.request.query_params.get('course')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        # Filter by my groups
        my_groups = self.request.query_params.get('my_groups') == 'true'
        if my_groups:
            queryset = queryset.filter(members=user, studygroupmembership__status='active')

        return queryset

    def perform_create(self, serializer):
        course = serializer.validated_data.get('course')
        if not is_global_branch_user(self.request.user):
            active_branch_id = get_effective_branch_id(self.request, self.request.user)
            if active_branch_id is None:
                raise PermissionDenied('No active branch scope available for this user.')
            if course is not None and not Group.objects.filter(course=course, branch_id=active_branch_id).exists():
                raise PermissionDenied('Selected course is outside your active branch scope.')
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a study group"""
        group = self.get_object()
        user = request.user
        active_branch_id = get_effective_branch_id(request, user)
        if active_branch_id is not None and not user_belongs_to_branch(user, active_branch_id):
            raise PermissionDenied('User is outside active branch scope.')

        # Check if can join
        can_join, message = group.can_join(user)
        if not can_join:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        # Create membership
        membership, created = StudyGroupMembership.objects.get_or_create(
            group=group,
            user=user,
            defaults={
                'status': 'pending' if group.require_approval else 'active',
                'role': 'member'
            }
        )

        if not created:
            return Response({'error': 'Already a member or pending'}, status=status.HTTP_400_BAD_REQUEST)

        status_msg = 'Join request sent' if group.require_approval else 'Joined successfully'
        return Response({'status': status_msg, 'membership_status': membership.status})

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a study group"""
        group = self.get_object()
        user = request.user

        try:
            membership = StudyGroupMembership.objects.get(group=group, user=user)
            membership.delete()
            return Response({'status': 'Left group successfully'})
        except StudyGroupMembership.DoesNotExist:
            return Response({'error': 'Not a member'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get group members"""
        group = self.get_object()
        memberships = group.studygroupmembership_set.filter(status='active').select_related('user')
        serializer = StudyGroupMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve_member(self, request, pk=None):
        """Approve pending membership (admin only)"""
        group = self.get_object()

        # Check if user is admin
        if not (request.user in group.admins.all() or request.user == group.creator):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        membership_id = request.data.get('membership_id')
        try:
            membership = StudyGroupMembership.objects.get(id=membership_id, group=group)
            membership.status = 'active'
            membership.save()
            return Response({'status': 'Member approved'})
        except StudyGroupMembership.DoesNotExist:
            return Response({'error': 'Membership not found'}, status=status.HTTP_404_NOT_FOUND)


class StudyGroupPostViewSet(viewsets.ModelViewSet):
    """
    Study group posts
    
    Posts within study groups
    """
    queryset = StudyGroupPost.objects.all().select_related('group', 'author')
    serializer_class = StudyGroupPostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            group__in=_scope_study_groups_to_active_branch(
                StudyGroup.objects.filter(is_active=True),
                self.request,
            )
        ).distinct()

        # Filter by group
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        return queryset

    def perform_create(self, serializer):
        group = serializer.validated_data['group']
        if not _scope_study_groups_to_active_branch(
            StudyGroup.objects.filter(id=group.id, is_active=True),
            self.request,
        ).exists():
            raise PermissionDenied('You do not have access to this study group.')
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like/unlike a post"""
        post = self.get_object()

        if request.user in post.likes.all():
            post.likes.remove(request.user)
            return Response({'status': 'unliked', 'like_count': post.like_count})
        else:
            post.likes.add(request.user)
            return Response({'status': 'liked', 'like_count': post.like_count})


class StudyGroupCommentViewSet(viewsets.ModelViewSet):
    """
    Study group comments
    
    Comments on study group posts
    """
    queryset = StudyGroupComment.objects.all().select_related('post', 'author')
    serializer_class = StudyGroupCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            post__group__in=_scope_study_groups_to_active_branch(
                StudyGroup.objects.filter(is_active=True),
                self.request,
            )
        ).distinct()

        # Filter by post
        post_id = self.request.query_params.get('post')
        if post_id:
            queryset = queryset.filter(post_id=post_id)

        return queryset

    def perform_create(self, serializer):
        post = serializer.validated_data['post']
        if not _scope_study_groups_to_active_branch(
            StudyGroup.objects.filter(id=post.group_id, is_active=True),
            self.request,
        ).exists():
            raise PermissionDenied('You do not have access to this study group post.')
        serializer.save(author=self.request.user)


# ==================== Social Feed ViewSets ====================

class FeedItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Social feed
    
    Activity stream of user activities
    """
    queryset = FeedItem.objects.filter(is_public=True).select_related('user')
    serializer_class = FeedItemSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        active_branch_id = get_effective_branch_id(self.request, user)
        if is_global_branch_user(user):
            if active_branch_id is not None:
                queryset = queryset.filter(
                    build_user_branch_q(active_branch_id, 'user')
                ).distinct()
        elif active_branch_id is None:
            return queryset.none()
        else:
            queryset = queryset.filter(
                build_user_branch_q(active_branch_id, 'user')
            ).distinct()

        # Filter options
        feed_type = self.request.query_params.get('type', 'all')

        if feed_type == 'my_feed':
            # User's own activities
            queryset = queryset.filter(user=user)
        elif feed_type == 'friends':
            # Activities from friends/connections (placeholder - implement friend system)
            # For now, show all
            pass
        elif feed_type == 'course':
            # Activities from users in same courses
            course_id = self.request.query_params.get('course_id')
            if course_id:
                # Get users in same course and show their activities
                # Placeholder - needs course enrollment check
                pass

        return queryset

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like/unlike a feed item"""
        feed_item = self.get_object()

        if request.user in feed_item.likes.all():
            feed_item.likes.remove(request.user)
            return Response({'status': 'unliked', 'like_count': feed_item.like_count})
        else:
            feed_item.likes.add(request.user)
            return Response({'status': 'liked', 'like_count': feed_item.like_count})


class FeedCommentViewSet(viewsets.ModelViewSet):
    """
    Feed comments
    
    Comments on feed items
    """
    queryset = FeedComment.objects.all().select_related('feed_item', 'author')
    serializer_class = FeedCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if is_global_branch_user(self.request.user):
            if active_branch_id is not None:
                queryset = queryset.filter(
                    build_user_branch_q(active_branch_id, 'feed_item__user')
                ).distinct()
        elif active_branch_id is None:
            return queryset.none()
        else:
            queryset = queryset.filter(
                build_user_branch_q(active_branch_id, 'feed_item__user')
            ).distinct()

        # Filter by feed item
        feed_item_id = self.request.query_params.get('feed_item')
        if feed_item_id:
            queryset = queryset.filter(feed_item_id=feed_item_id)

        return queryset

    def perform_create(self, serializer):
        feed_item = serializer.validated_data['feed_item']
        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if active_branch_id is None and not is_global_branch_user(self.request.user):
            raise PermissionDenied('No active branch scope available for this user.')
        if active_branch_id is not None and not (
            feed_item.user_id == self.request.user.id
            or user_belongs_to_branch(feed_item.user, active_branch_id)
        ):
            raise PermissionDenied('You do not have access to this feed item.')
        serializer.save(author=self.request.user)


# ==================== Messaging ViewSets ====================

class ConversationViewSet(viewsets.ModelViewSet):
    """
    Conversations
    
    Direct messages and group chats
    """
    queryset = Conversation.objects.all().prefetch_related('participants')
    permission_classes = [IsAuthenticated]
    ordering = ['-updated_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ConversationCreateSerializer
        elif self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationListSerializer

    def get_queryset(self):
        # Only show conversations user is part of
        queryset = self.queryset.filter(participants=self.request.user)
        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if is_global_branch_user(self.request.user):
            if active_branch_id is None:
                return queryset.distinct()
        elif active_branch_id is None:
            return queryset.none()

        out_of_scope_users = User.objects.exclude(
            build_direct_user_branch_q(active_branch_id)
        ).distinct()

        return queryset.filter(
            build_user_branch_q(active_branch_id, 'participants')
            | build_user_branch_q(active_branch_id, 'creator')
        ).exclude(participants__in=out_of_scope_users).distinct()

    def perform_create(self, serializer):
        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if active_branch_id is None and not is_global_branch_user(self.request.user):
            raise PermissionDenied('No active branch scope available for this user.')
        participant_ids = serializer.validated_data.get('participant_ids', [])
        normalized_participant_ids = set()
        for participant_id in participant_ids:
            try:
                normalized_participant_ids.add(int(participant_id))
            except (TypeError, ValueError):
                continue

        participants = list(User.objects.filter(id__in=normalized_participant_ids))
        missing_user_ids = sorted(normalized_participant_ids - {participant.id for participant in participants})
        if missing_user_ids:
            raise PermissionDenied(f'Users {missing_user_ids} were not found.')

        if active_branch_id is not None:
            invalid_user_ids = []
            for participant in participants:
                if not user_belongs_to_branch(participant, active_branch_id):
                    invalid_user_ids.append(participant.id)
            if invalid_user_ids:
                raise PermissionDenied(
                    f'Users {invalid_user_ids} are outside your active branch scope.'
                )

        serializer.save()

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages in conversation"""
        conversation = self.get_object()
        messages = conversation.social_messages.select_related('sender').order_by('created_at')

        # Pagination
        page = self.paginate_queryset(messages)
        if page is not None:
            serializer = MessageSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message in conversation"""
        conversation = self.get_object()

        # Check if user is participant
        if request.user not in conversation.participants.all():
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content')
        attachments = request.data.get('attachments', [])
        reply_to_id = request.data.get('reply_to')

        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
            attachments=attachments,
            reply_to_id=reply_to_id
        )

        # Create read receipts for all participants except sender
        for participant in conversation.participants.exclude(id=request.user.id):
            MessageReadReceipt.objects.create(
                message=message,
                user=participant,
                is_read=False
            )

        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Mark all messages as read"""
        conversation = self.get_object()

        # Mark all unread messages as read
        receipts = MessageReadReceipt.objects.filter(
            message__conversation=conversation,
            user=request.user,
            is_read=False
        )

        for receipt in receipts:
            receipt.mark_as_read()

        return Response({'status': 'marked as read', 'count': receipts.count()})


# ==================== Notifications ViewSet ====================

class SocialNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Social notifications
    
    Notifications for social activities
    """
    queryset = SocialNotification.objects.all()
    serializer_class = SocialNotificationSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']

    def get_queryset(self):
        # Only show user's own notifications
        queryset = self.queryset.filter(user=self.request.user)

        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')

        return queryset

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get unread notification count"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """Mark all notifications as read"""
        notifications = self.get_queryset().filter(is_read=False)
        count = notifications.count()

        for notification in notifications:
            notification.mark_as_read()

        return Response({'status': 'all marked as read', 'count': count})

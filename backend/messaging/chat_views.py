"""
REST API views for chat history and conversations.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.utils import timezone

from .models import Conversation, ChatMessage, UserPresence
from .chat_serializers import (
    ConversationSerializer,
    ConversationDetailSerializer,
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
    UserPresenceSerializer
)
from ai.hybrid_ai_handler import process_user_message
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
)
from users.models import User


def _scope_conversations_to_active_branch(queryset, request, user):
    active_branch_id = get_effective_branch_id(request, user)
    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    scoped_queryset = queryset.filter(
        build_user_branch_q(active_branch_id, 'user')
        | build_user_branch_q(active_branch_id, 'participants')
    ).distinct()
    out_of_scope_users = User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()
    return scoped_queryset.exclude(participants__in=out_of_scope_users).distinct()


def _scope_presence_to_active_branch(queryset, request, user):
    active_branch_id = get_effective_branch_id(request, user)
    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    return queryset.filter(
        build_user_branch_q(active_branch_id, 'user')
    ).distinct()


class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing conversations.

    list: Get all user conversations
    retrieve: Get specific conversation with messages
    create: Create new conversation
    destroy: Delete/archive conversation
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer
    queryset = Conversation.objects.all()

    def get_queryset(self):
        """Get conversations for current user."""
        queryset = Conversation.objects.filter(
            user=self.request.user,
            is_active=True,
        )
        return _scope_conversations_to_active_branch(
            queryset,
            self.request,
            self.request.user,
        ).annotate(
            message_count=Count('messages')
        ).order_by('-updated_at')

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action."""
        if self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        """Create conversation for current user."""
        if get_effective_branch_id(self.request, self.request.user) is None and not is_global_branch_user(self.request.user):
            raise PermissionDenied('No active branch scope available for this user.')
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """
        Send a message in a conversation.

        POST /api/conversations/{id}/send_message/
        Body: { "content": "Hello", "message_type": "text" }
        """
        conversation = self.get_object()
        serializer = ChatMessageCreateSerializer(data=request.data)

        if serializer.is_valid():
            # Save user message
            user_message = serializer.save(
                conversation=conversation,
                sender=request.user,
                sender_type='user'
            )

            # Process with AI
            ai_response = process_user_message(
                text=user_message.content,
                user=request.user,
                conversation_id=str(conversation.conversation_id)
            )

            # Save AI response
            ai_message = ChatMessage.objects.create(
                conversation=conversation,
                sender_type='ai',
                message_type='text',
                content=ai_response['response'],
                intent=ai_response.get('detected_intent'),
                confidence=ai_response.get('intent_confidence'),
                metadata=ai_response.get('metadata', {})
            )

            return Response({
                'user_message': ChatMessageSerializer(user_message).data,
                'ai_message': ChatMessageSerializer(ai_message).data,
                'metadata': ai_response.get('metadata')
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """
        Get paginated messages for a conversation.

        GET /api/conversations/{id}/messages/?limit=50&before={message_id}
        """
        conversation = self.get_object()
        limit = int(request.query_params.get('limit', 50))
        before_id = request.query_params.get('before')

        queryset = conversation.messages.all().order_by('-created_at')

        if before_id:
            try:
                before_message = conversation.messages.get(message_id=before_id)
                queryset = queryset.filter(created_at__lt=before_message.created_at)
            except ChatMessage.DoesNotExist:
                pass

        messages = queryset[:limit]
        serializer = ChatMessageSerializer(messages, many=True)

        return Response({
            'messages': list(reversed(serializer.data)),  # Chronological order
            'has_more': len(messages) >= limit
        })

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """
        Mark all unread messages in conversation as read.

        POST /api/conversations/{id}/mark_read/
        """
        conversation = self.get_object()

        updated_count = conversation.messages.filter(
            sender_type='ai',
            read_at__isnull=True
        ).update(
            status='read',
            read_at=timezone.now()
        )

        return Response({
            'marked_read': updated_count,
            'message': f'{updated_count} messages marked as read'
        })

    @action(detail=True, methods=['delete'])
    def archive(self, request, pk=None):
        """
        Archive (soft delete) a conversation.

        DELETE /api/conversations/{id}/archive/
        """
        conversation = self.get_object()
        conversation.is_active = False
        conversation.save()

        return Response({'message': 'Conversation archived'})

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search conversations and messages.

        GET /api/conversations/search/?q=query
        """
        query = request.query_params.get('q', '')
        if not query:
            return Response({'error': 'Query parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Search in conversation titles and message content
        conversations = Conversation.objects.filter(
            Q(user=request.user) &
            Q(is_active=True) &
            (Q(title__icontains=query) | Q(messages__content__icontains=query))
        )
        conversations = _scope_conversations_to_active_branch(
            conversations,
            request,
            request.user,
        ).distinct().order_by('-updated_at')[:20]

        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return Response({'results': serializer.data})


class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for chat messages (read-only).

    Use ConversationViewSet.send_message() to create new messages.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ChatMessageSerializer
    queryset = ChatMessage.objects.all()

    def get_queryset(self):
        """Get messages for user's conversations."""
        conversations = _scope_conversations_to_active_branch(
            Conversation.objects.filter(
                Q(user=self.request.user) | Q(participants=self.request.user),
                is_active=True,
            ),
            self.request,
            self.request.user,
        )
        return ChatMessage.objects.filter(
            conversation__in=conversations,
        ).select_related('conversation', 'sender').order_by('-created_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark specific message as read."""
        message = self.get_object()

        if message.sender_type == 'ai' and not message.read_at:
            message.status = 'read'
            message.read_at = timezone.now()
            message.save()

        return Response({'message': 'Marked as read'})


class UserPresenceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for user presence (online/offline status).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserPresenceSerializer
    queryset = UserPresence.objects.select_related('user').all()

    def get_queryset(self):
        return _scope_presence_to_active_branch(
            UserPresence.objects.select_related('user').all(),
            self.request,
            self.request.user,
        ).order_by('-last_seen')

    @action(detail=False, methods=['post'])
    def update_status(self, request):
        """
        Update current user's presence status.

        POST /api/presence/update_status/
        Body: { "status": "online|away|offline" }
        """
        new_status = request.data.get('status')

        if new_status not in ['online', 'away', 'offline']:
            return Response(
                {'error': 'Invalid status. Must be: online, away, or offline'},
                status=status.HTTP_400_BAD_REQUEST
            )

        presence, created = UserPresence.objects.get_or_create(user=request.user)
        presence.status = new_status
        presence.save()

        serializer = UserPresenceSerializer(presence)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def online_users(self, request):
        """
        Get list of currently online users.

        GET /api/presence/online_users/
        """
        online_users = UserPresence.objects.filter(
            status='online'
        ).select_related('user')
        online_users = _scope_presence_to_active_branch(
            online_users,
            request,
            request.user,
        )

        serializer = UserPresenceSerializer(online_users, many=True)
        return Response({'online_users': serializer.data})

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from users.models import User
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
    user_belongs_to_branch,
)

from .models import AutomaticMessage, ChatMessage, Conversation, MessageTemplate, SmsHistory
from .serializers import (
    AutomaticMessageSerializer,
    ChatMessageSerializer,
    ConversationSerializer,
    MessageTemplateSerializer,
    SendMessageSerializer,
    SmsHistorySerializer,
)
from .services import send_sms


def _scope_users_to_active_branch(queryset, request, user):
    active_branch_id = get_effective_branch_id(request, user)
    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    return queryset.filter(build_direct_user_branch_q(active_branch_id)).distinct()


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


class AutomaticMessageViewSet(viewsets.ModelViewSet):
    queryset = AutomaticMessage.objects.all()
    serializer_class = AutomaticMessageSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        if is_global_branch_user(self.request.user):
            return super().get_queryset()
        return AutomaticMessage.objects.none()

    def perform_create(self, serializer):
        if not is_global_branch_user(self.request.user):
            raise PermissionDenied('Only global admins can manage automatic messages.')
        serializer.save()

    def perform_update(self, serializer):
        if not is_global_branch_user(self.request.user):
            raise PermissionDenied('Only global admins can manage automatic messages.')
        serializer.save()


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        if is_global_branch_user(self.request.user):
            return super().get_queryset()
        return MessageTemplate.objects.none()

    def perform_create(self, serializer):
        if not is_global_branch_user(self.request.user):
            raise PermissionDenied('Only global admins can manage message templates.')
        serializer.save()

    def perform_update(self, serializer):
        if not is_global_branch_user(self.request.user):
            raise PermissionDenied('Only global admins can manage message templates.')
        serializer.save()


class SmsHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SmsHistory.objects.all()
    serializer_class = SmsHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = _scope_users_to_active_branch(
            SmsHistory.objects.select_related('recipient'),
            self.request,
            self.request.user,
        )
        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(sent_at__date=date_param)
        return queryset.order_by('-sent_at')


class SendMessageView(generics.GenericAPIView):
    serializer_class = SendMessageSerializer
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_ids = serializer.validated_data['recipient_user_ids']
        message_text = serializer.validated_data['message_text']
        message_type = serializer.validated_data.get('message_type', 'platform')

        recipients = _scope_users_to_active_branch(
            User.objects.filter(id__in=user_ids),
            request,
            request.user,
        )
        recipients_by_id = {recipient.id: recipient for recipient in recipients}
        blocked_user_ids = sorted(set(user_ids) - set(recipients_by_id.keys()))
        if blocked_user_ids:
            raise PermissionDenied(
                f'Users {blocked_user_ids} are outside your active branch scope.'
            )

        sent_count = 0

        if message_type == 'sms':
            for user in recipients_by_id.values():
                if not user.phone:
                    continue

                sms_ok = send_sms(user.phone, message_text)
                SmsHistory.objects.create(
                    recipient=user,
                    phone_number=user.phone,
                    message_text=message_text,
                    status='sent' if sms_ok else 'failed',
                )
                if sms_ok:
                    sent_count += 1

        return Response(
            {'detail': f'Message job queued for {sent_count} user(s).'},
            status=status.HTTP_200_OK,
        )


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Conversation.objects.all()

    def get_queryset(self):
        user = self.request.user
        return (
            _scope_conversations_to_active_branch(
                Conversation.objects.filter(is_active=True),
                self.request,
                user,
            )
            .filter(Q(user=user) | Q(participants=user))
            .prefetch_related('participants')
            .order_by('-updated_at')
            .distinct()
        )

    def perform_create(self, serializer):
        participant_ids = self.request.data.get('participant_ids') or self.request.data.get('participants') or []
        conversation_type = self.request.data.get('conversation_type', 'platform')
        title = serializer.validated_data.get('title')

        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        if active_branch_id is None and not is_global_branch_user(self.request.user):
            raise PermissionDenied('No active branch scope available for this user.')
        normalized_participant_ids = set()
        for participant_id in participant_ids:
            try:
                normalized_participant_ids.add(int(participant_id))
            except (TypeError, ValueError):
                continue

        participant_users = list(User.objects.filter(id__in=normalized_participant_ids))
        missing_user_ids = sorted(normalized_participant_ids - {participant.id for participant in participant_users})
        if missing_user_ids:
            raise PermissionDenied(f'Users {missing_user_ids} were not found.')
        if active_branch_id is not None:
            invalid_user_ids = [
                participant.id
                for participant in participant_users
                if not user_belongs_to_branch(participant, active_branch_id)
            ]
            if invalid_user_ids:
                raise PermissionDenied(
                    f'Users {invalid_user_ids} are outside your active branch scope.'
                )

        conversation = serializer.save(
            user=self.request.user,
            conversation_type=conversation_type,
        )

        participant_ids_set = {participant.id for participant in participant_users}
        participant_ids_set.add(self.request.user.id)
        conversation.participants.set(list(participant_ids_set))

        if not title:
            names = []
            for participant in conversation.participants.exclude(id=self.request.user.id):
                full_name = f'{participant.first_name} {participant.last_name}'.strip()
                names.append(full_name or participant.username)
            conversation.title = ', '.join(names[:3]) or self.request.user.username
            conversation.save(update_fields=['title', 'updated_at'])

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()

        # Mark incoming unread messages as read when chat history is opened.
        conversation.messages.exclude(sender=request.user).filter(read_at__isnull=True).update(
            status='read',
            read_at=timezone.now(),
        )

        queryset = conversation.messages.select_related('sender').order_by('created_at')
        page = self.paginate_queryset(queryset)
        serializer = ChatMessageSerializer(page if page is not None else queryset, many=True, context={'request': request})

        if page is not None:
            return self.get_paginated_response(serializer.data)

        return Response({'count': queryset.count(), 'results': serializer.data})

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        conversation = self.get_object()
        content = (request.data.get('content') or '').strip()
        message_type = request.data.get('message_type', 'text')
        metadata = request.data.get('metadata') or {}

        if not content:
            return Response({'detail': 'Message content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            sender_type='user',
            message_type=message_type,
            content=content,
            status='sent',
            metadata=metadata,
        )
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

        serializer = ChatMessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        conversation = self.get_object()
        message_ids = request.data.get('message_ids') or []

        queryset = conversation.messages.exclude(sender=request.user).filter(read_at__isnull=True)
        if message_ids:
            queryset = queryset.filter(message_id__in=message_ids)

        updated = queryset.update(status='read', read_at=timezone.now())
        return Response({'marked_read': updated}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def send_sms(self, request, pk=None):
        conversation = self.get_object()
        message_text = (request.data.get('message_text') or '').strip()
        if not message_text:
            return Response({'detail': 'Message text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        participants = _scope_users_to_active_branch(
            conversation.participants.exclude(id=request.user.id),
            request,
            request.user,
        )
        for participant in participants:
            if participant.phone:
                sms_ok = send_sms(participant.phone, message_text)
                SmsHistory.objects.create(
                    recipient=participant,
                    phone_number=participant.phone,
                    message_text=message_text,
                    status='sent' if sms_ok else 'failed',
                )

        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            sender_type='user',
            message_type='text',
            content=message_text,
            status='sent',
            metadata={'channel': 'sms'},
        )
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])

        serializer = ChatMessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

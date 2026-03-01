from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.models import User

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


class AutomaticMessageViewSet(viewsets.ModelViewSet):
    queryset = AutomaticMessage.objects.all()
    serializer_class = AutomaticMessageSerializer
    permission_classes = [permissions.IsAdminUser]


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [permissions.IsAdminUser]


class SmsHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SmsHistory.objects.all()
    serializer_class = SmsHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SmsHistory.objects.all()
        date_param = self.request.query_params.get('date')
        if date_param:
            queryset = queryset.filter(sent_at__date=date_param)
        return queryset.select_related('recipient').order_by('-sent_at')


class SendMessageView(generics.GenericAPIView):
    serializer_class = SendMessageSerializer
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_ids = serializer.validated_data['recipient_user_ids']
        message_text = serializer.validated_data['message_text']
        message_type = serializer.validated_data.get('message_type', 'platform')

        recipients = User.objects.filter(id__in=user_ids)
        sent_count = 0

        if message_type == 'sms':
            for user in recipients:
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

    def get_queryset(self):
        user = self.request.user
        return (
            Conversation.objects.filter(is_active=True)
            .filter(Q(user=user) | Q(participants=user))
            .prefetch_related('participants')
            .order_by('-updated_at')
            .distinct()
        )

    def perform_create(self, serializer):
        participant_ids = self.request.data.get('participant_ids') or self.request.data.get('participants') or []
        conversation_type = self.request.data.get('conversation_type', 'platform')
        title = serializer.validated_data.get('title')

        conversation = serializer.save(
            user=self.request.user,
            conversation_type=conversation_type,
        )

        participant_users = User.objects.filter(id__in=participant_ids)
        participant_ids_set = set(participant_users.values_list('id', flat=True))
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

        for participant in conversation.participants.exclude(id=request.user.id):
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


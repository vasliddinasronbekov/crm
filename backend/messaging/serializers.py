from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import MessageTemplate, SmsHistory, AutomaticMessage, Conversation, ChatMessage

User = get_user_model()


class AutomaticMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomaticMessage
        fields = '__all__'


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = '__all__'


class SmsHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsHistory
        fields = '__all__'
        depth = 1


class SendMessageSerializer(serializers.Serializer):
    recipient_user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        help_text='List of recipient user ids. Example: [2, 3, 4]',
    )
    message_text = serializers.CharField(max_length=1000, required=True)
    message_type = serializers.ChoiceField(choices=['platform', 'sms'], default='platform')

    def validate_recipient_user_ids(self, value):
        if not value:
            raise serializers.ValidationError('Recipient list cannot be empty.')
        return value


class ConversationParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone', 'photo']


class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ConversationParticipantSerializer(read_only=True)
    sent_at = serializers.DateTimeField(source='created_at', read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'message_id',
            'conversation',
            'sender',
            'sender_type',
            'message_type',
            'content',
            'status',
            'metadata',
            'created_at',
            'sent_at',
            'read_at',
            'is_read',
        ]
        read_only_fields = ['id', 'message_id', 'created_at', 'sent_at', 'read_at', 'is_read']

    def get_is_read(self, obj):
        return bool(obj.read_at) or obj.status == 'read'


class ConversationSerializer(serializers.ModelSerializer):
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    last_message = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'conversation_id',
            'title',
            'conversation_type',
            'participants',
            'participant_ids',
            'last_message',
            'last_message_at',
            'unread_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'conversation_id',
            'last_message',
            'last_message_at',
            'unread_count',
            'created_at',
            'updated_at',
        ]

    def get_last_message(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if not last_message:
            return None
        return ChatMessageSerializer(last_message, context=self.context).data

    def get_last_message_at(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if not last_message:
            return None
        return last_message.created_at

    def get_unread_count(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return 0

        return obj.messages.exclude(sender=user).filter(read_at__isnull=True).count()

    def create(self, validated_data):
        validated_data.pop('participant_ids', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('participant_ids', None)
        return super().update(instance, validated_data)

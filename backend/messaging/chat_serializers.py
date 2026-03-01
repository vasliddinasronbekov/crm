"""
Serializers for real-time chat and conversation models.
"""
from rest_framework import serializers
from .models import Conversation, ChatMessage, UserPresence, ConversationAnalytics
from users.serializers import UserSerializer


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages with full details."""
    sender_info = UserSerializer(source='sender', read_only=True)

    class Meta:
        model = ChatMessage
        fields = [
            'message_id', 'conversation', 'sender_type', 'sender', 'sender_info',
            'message_type', 'content', 'audio_url', 'audio_duration', 'file_url',
            'intent', 'confidence', 'entities', 'status', 'created_at',
            'delivered_at', 'read_at', 'metadata'
        ]
        read_only_fields = ['message_id', 'created_at', 'sender_info']


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new chat messages."""

    class Meta:
        model = ChatMessage
        fields = [
            'conversation', 'sender_type', 'sender', 'message_type', 'content',
            'audio_url', 'audio_duration', 'file_url', 'metadata'
        ]


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for conversations with message preview."""
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'conversation_id', 'conversation_type', 'user', 'title',
            'created_at', 'updated_at', 'is_active', 'metadata',
            'last_message', 'unread_count'
        ]
        read_only_fields = ['conversation_id', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return {
                'content': last_msg.content[:100],
                'created_at': last_msg.created_at,
                'sender_type': last_msg.sender_type
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(
                sender_type='ai',
                read_at__isnull=True
            ).count()
        return 0


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Detailed conversation serializer with recent messages."""
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'conversation_id', 'conversation_type', 'user', 'title',
            'created_at', 'updated_at', 'is_active', 'metadata', 'messages'
        ]
        read_only_fields = ['conversation_id', 'created_at', 'updated_at']


class UserPresenceSerializer(serializers.ModelSerializer):
    """Serializer for user presence/online status."""
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserPresence
        fields = ['user', 'username', 'status', 'last_seen', 'is_typing', 'typing_in_conversation']
        read_only_fields = ['user', 'username', 'last_seen']


class ConversationAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for conversation analytics."""

    class Meta:
        model = ConversationAnalytics
        fields = [
            'conversation', 'date', 'total_messages', 'user_messages', 'ai_messages',
            'intents_detected', 'avg_confidence', 'avg_response_time',
            'total_audio_duration', 'total_cost'
        ]
        read_only_fields = ['date']

"""
WebSocket URL routing for messaging app.
"""
from django.urls import re_path
from . import consumers
from .enhanced_consumer import EnhancedChatConsumer

websocket_urlpatterns = [
    # Legacy AI consumer (voice chat)
    re_path(r'ws/ai/(?P<tenant_id>\w+)/$', consumers.AIConsumer.as_asgi()),

    # Real-time chat consumer (for Parent Portal)
    re_path(r'ws/chat/(?P<conversation_id>\d+)/$', consumers.ChatConsumer.as_asgi()),

    # Enhanced chat consumer (text chat with typing, persistence, etc.)
    re_path(r'ws/chat/(?P<conversation_id>[0-9a-f-]+)/$', EnhancedChatConsumer.as_asgi()),
    re_path(r'ws/chat/$', EnhancedChatConsumer.as_asgi()),  # Auto-create conversation
]

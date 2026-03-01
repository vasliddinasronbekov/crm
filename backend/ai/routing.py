from django.urls import path
from .consumers_voice import VoiceConsumer, TextChatConsumer

websocket_urlpatterns = [
    path("ws/ai/voice/", VoiceConsumer.as_asgi()),
    path("ws/ai/chat/", TextChatConsumer.as_asgi()),
]

"""
URL patterns for chat API endpoints.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .chat_views import ConversationViewSet, ChatMessageViewSet, UserPresenceViewSet
from .file_upload_views import upload_message_attachment, delete_message_attachment

router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', ChatMessageViewSet, basename='message')
router.register(r'presence', UserPresenceViewSet, basename='presence')

urlpatterns = [
    # File upload endpoints
    path('upload/', upload_message_attachment, name='message-upload'),
    path('upload/<int:message_id>/', delete_message_attachment, name='message-delete-attachment'),

    # Router URLs
    path('', include(router.urls)),
]

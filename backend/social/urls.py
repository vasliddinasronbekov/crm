"""
Social Learning URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ForumCategoryViewSet, ForumViewSet, ForumTopicViewSet, ForumPostViewSet,
    StudyGroupViewSet, StudyGroupPostViewSet, StudyGroupCommentViewSet,
    FeedItemViewSet, FeedCommentViewSet,
    ConversationViewSet, SocialNotificationViewSet
)

router = DefaultRouter()

# Forums
router.register(r'forum-categories', ForumCategoryViewSet, basename='forum-category')
router.register(r'forums', ForumViewSet, basename='forum')
router.register(r'topics', ForumTopicViewSet, basename='topic')
router.register(r'posts', ForumPostViewSet, basename='post')

# Study Groups
router.register(r'study-groups', StudyGroupViewSet, basename='study-group')
router.register(r'group-posts', StudyGroupPostViewSet, basename='group-post')
router.register(r'group-comments', StudyGroupCommentViewSet, basename='group-comment')

# Social Feed
router.register(r'feed', FeedItemViewSet, basename='feed-item')
router.register(r'feed-comments', FeedCommentViewSet, basename='feed-comment')

# Messaging
router.register(r'conversations', ConversationViewSet, basename='conversation')

# Notifications
router.register(r'notifications', SocialNotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]

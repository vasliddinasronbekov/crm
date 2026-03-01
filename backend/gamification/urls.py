"""
Gamification URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BadgeViewSet, UserLevelViewSet, DailyChallengeViewSet,
    AchievementViewSet, LeaderboardViewSet, GamificationProfileViewSet
)

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'levels', UserLevelViewSet, basename='userlevel')
router.register(r'daily-challenges', DailyChallengeViewSet, basename='dailychallenge')
router.register(r'achievements', AchievementViewSet, basename='achievement')
router.register(r'leaderboard', LeaderboardViewSet, basename='leaderboard')
router.register(r'profile', GamificationProfileViewSet, basename='gamification-profile')

urlpatterns = [
    path('', include(router.urls)),
]

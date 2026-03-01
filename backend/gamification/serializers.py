"""
Gamification Serializers
"""

from rest_framework import serializers
from .models import (
    Badge, UserBadge, UserLevel, XPTransaction,
    DailyChallenge, UserDailyChallenge,
    Achievement, UserAchievement, Leaderboard
)
from django.contrib.auth import get_user_model

User = get_user_model()


class BadgeSerializer(serializers.ModelSerializer):
    """Badge serializer with localized fields"""

    class Meta:
        model = Badge
        fields = [
            'id', 'name', 'name_uz', 'name_ru',
            'description', 'description_uz', 'description_ru',
            'icon', 'badge_type', 'xp_reward', 'coins_reward',
            'rarity', 'is_active', 'created_at'
        ]


class UserBadgeSerializer(serializers.ModelSerializer):
    """User earned badges"""
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['id', 'badge', 'earned_at', 'is_showcased', 'earned_for']


class XPTransactionSerializer(serializers.ModelSerializer):
    """XP transaction history"""

    class Meta:
        model = XPTransaction
        fields = ['id', 'amount', 'transaction_type', 'reason', 'new_balance', 'created_at']


class UserLevelSerializer(serializers.ModelSerializer):
    """User level and XP progress"""
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    photo = serializers.ImageField(source='user.photo', read_only=True)

    # Calculate XP progress percentage
    xp_progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = UserLevel
        fields = [
            'id', 'username', 'first_name', 'photo',
            'total_xp', 'current_level', 'xp_to_next_level',
            'xp_progress_percentage',
            'current_streak_days', 'longest_streak_days',
            'last_activity_date', 'updated_at'
        ]

    def get_xp_progress_percentage(self, obj):
        """Calculate % progress to next level"""
        if obj.xp_to_next_level == 0:
            return 100
        return round((obj.total_xp / obj.xp_to_next_level) * 100, 2)


class DailyChallengeSerializer(serializers.ModelSerializer):
    """Daily challenge"""

    class Meta:
        model = DailyChallenge
        fields = [
            'id', 'title', 'title_uz', 'title_ru',
            'description', 'description_uz', 'description_ru',
            'challenge_type', 'target_value',
            'xp_reward', 'coins_reward', 'difficulty'
        ]


class UserDailyChallengeSerializer(serializers.ModelSerializer):
    """User's daily challenge progress"""
    challenge = DailyChallengeSerializer(read_only=True)
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = UserDailyChallenge
        fields = [
            'id', 'challenge', 'date_assigned',
            'current_progress', 'is_completed', 'completed_at',
            'progress_percentage'
        ]

    def get_progress_percentage(self, obj):
        """Calculate progress percentage"""
        if obj.challenge.target_value == 0:
            return 100 if obj.is_completed else 0
        percentage = (obj.current_progress / obj.challenge.target_value) * 100
        return min(round(percentage, 2), 100)


class AchievementSerializer(serializers.ModelSerializer):
    """Achievement"""

    class Meta:
        model = Achievement
        fields = [
            'id', 'name', 'name_uz', 'name_ru',
            'description', 'description_uz', 'description_ru',
            'icon', 'tiers', 'category', 'is_secret'
        ]


class UserAchievementSerializer(serializers.ModelSerializer):
    """User's achievement progress"""
    achievement = AchievementSerializer(read_only=True)
    current_tier_info = serializers.SerializerMethodField()
    next_tier_info = serializers.SerializerMethodField()

    class Meta:
        model = UserAchievement
        fields = [
            'id', 'achievement', 'current_tier', 'progress',
            'current_tier_info', 'next_tier_info',
            'unlocked_at', 'last_updated'
        ]

    def get_current_tier_info(self, obj):
        """Get current tier details"""
        if obj.achievement.tiers and obj.current_tier > 0:
            try:
                return obj.achievement.tiers[obj.current_tier - 1]
            except IndexError:
                return None
        return None

    def get_next_tier_info(self, obj):
        """Get next tier details"""
        if obj.achievement.tiers and obj.current_tier < len(obj.achievement.tiers):
            try:
                return obj.achievement.tiers[obj.current_tier]
            except IndexError:
                return None
        return None


class LeaderboardEntrySerializer(serializers.Serializer):
    """Leaderboard entry (not a model serializer)"""
    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    photo = serializers.ImageField(allow_null=True)
    score = serializers.IntegerField()
    level = serializers.IntegerField(required=False)
    badge_count = serializers.IntegerField(required=False)


class UserGamificationProfileSerializer(serializers.Serializer):
    """Complete gamification profile for a user"""
    level_info = UserLevelSerializer()
    badges = UserBadgeSerializer(many=True)
    recent_xp = XPTransactionSerializer(many=True)
    daily_challenges = UserDailyChallengeSerializer(many=True)
    achievements = UserAchievementSerializer(many=True)
    leaderboard_rank = serializers.IntegerField(allow_null=True)

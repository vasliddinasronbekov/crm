"""
Gamification API Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, F
from django.utils import timezone
from datetime import timedelta

from .models import (
    Badge, UserBadge, UserLevel, XPTransaction,
    DailyChallenge, UserDailyChallenge,
    Achievement, UserAchievement, Leaderboard
)
from .serializers import (
    BadgeSerializer, UserBadgeSerializer, UserLevelSerializer,
    XPTransactionSerializer, DailyChallengeSerializer,
    UserDailyChallengeSerializer, AchievementSerializer,
    UserAchievementSerializer, LeaderboardEntrySerializer,
    UserGamificationProfileSerializer
)
from .signals import assign_daily_challenges


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for badges

    list: Get all available badges
    retrieve: Get specific badge details
    my_badges: Get current user's earned badges
    """
    queryset = Badge.objects.filter(is_active=True)
    serializer_class = BadgeSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_badges(self, request):
        """Get current user's earned badges"""
        user_badges = UserBadge.objects.filter(user=request.user).select_related('badge')
        serializer = UserBadgeSerializer(user_badges, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def showcase(self, request, pk=None):
        """Toggle badge showcase on profile"""
        try:
            user_badge = UserBadge.objects.get(user=request.user, badge_id=pk)
            user_badge.is_showcased = not user_badge.is_showcased
            user_badge.save()
            return Response({'showcased': user_badge.is_showcased})
        except UserBadge.DoesNotExist:
            return Response(
                {'error': 'Badge not earned yet'},
                status=status.HTTP_404_NOT_FOUND
            )


class UserLevelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for user levels and XP

    my_profile: Get current user's level and XP info
    xp_history: Get XP transaction history
    streak_info: Get streak statistics
    """
    queryset = UserLevel.objects.all()
    serializer_class = UserLevelSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get current user's level info"""
        user_level, created = UserLevel.objects.get_or_create(user=request.user)
        serializer = UserLevelSerializer(user_level)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def xp_history(self, request):
        """Get XP transaction history"""
        limit = int(request.query_params.get('limit', 20))
        transactions = XPTransaction.objects.filter(user=request.user)[:limit]
        serializer = XPTransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def streak_info(self, request):
        """Get detailed streak information"""
        user_level, created = UserLevel.objects.get_or_create(user=request.user)

        # Calculate if streak is active today
        today = timezone.now().date()
        streak_active = user_level.last_activity_date == today

        return Response({
            'current_streak': user_level.current_streak_days,
            'longest_streak': user_level.longest_streak_days,
            'last_activity': user_level.last_activity_date,
            'streak_active_today': streak_active,
            'days_until_break': 1 if streak_active else 0
        })


class DailyChallengeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for daily challenges

    list: Get all active challenges
    my_challenges: Get today's challenges for current user
    progress: Update challenge progress
    """
    queryset = DailyChallenge.objects.filter(is_active=True)
    serializer_class = DailyChallengeSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_challenges(self, request):
        """Get today's challenges for the current user"""
        today = timezone.now().date()

        # Ensure user has challenges assigned
        assign_daily_challenges(request.user)

        # Get today's challenges
        user_challenges = UserDailyChallenge.objects.filter(
            user=request.user,
            date_assigned=today
        ).select_related('challenge')

        serializer = UserDailyChallengeSerializer(user_challenges, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def progress(self, request, pk=None):
        """Update progress on a specific challenge"""
        today = timezone.now().date()
        increment = int(request.data.get('increment', 1))

        try:
            user_challenge = UserDailyChallenge.objects.get(
                user=request.user,
                challenge_id=pk,
                date_assigned=today
            )

            success = user_challenge.update_progress(increment)
            serializer = UserDailyChallengeSerializer(user_challenge)

            return Response({
                'success': success,
                'challenge': serializer.data
            })
        except UserDailyChallenge.DoesNotExist:
            return Response(
                {'error': 'Challenge not assigned today'},
                status=status.HTTP_404_NOT_FOUND
            )


class AchievementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for achievements

    list: Get all achievements (hide secret ones if not unlocked)
    my_achievements: Get current user's achievement progress
    """
    queryset = Achievement.objects.filter(is_active=True)
    serializer_class = AchievementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter out secret achievements user hasn't unlocked"""
        user = self.request.user

        # Get user's unlocked achievement IDs
        unlocked_ids = UserAchievement.objects.filter(
            user=user,
            unlocked_at__isnull=False
        ).values_list('achievement_id', flat=True)

        # Show all non-secret achievements + unlocked secret ones
        return Achievement.objects.filter(
            Q(is_active=True) &
            (Q(is_secret=False) | Q(id__in=unlocked_ids))
        )

    @action(detail=False, methods=['get'])
    def my_achievements(self, request):
        """Get current user's achievement progress"""
        user_achievements = UserAchievement.objects.filter(
            user=request.user
        ).select_related('achievement')

        serializer = UserAchievementSerializer(user_achievements, many=True)
        return Response(serializer.data)


class LeaderboardViewSet(viewsets.ViewSet):
    """
    API endpoint for leaderboards

    list: Get leaderboard rankings
    my_rank: Get current user's rank
    """
    permission_classes = [IsAuthenticated]
    serializer_class = LeaderboardEntrySerializer
    queryset = UserLevel.objects.all()

    def list(self, request):
        """
        Get leaderboard rankings

        Query params:
        - type: xp (default), level, streak, quiz_score
        - scope: global (default), branch, course, group
        - period: all_time (default), monthly, weekly, daily
        - limit: 100 (default)
        """
        leaderboard_type = request.query_params.get('type', 'xp')
        scope = request.query_params.get('scope', 'global')
        period = request.query_params.get('period', 'all_time')
        limit = int(request.query_params.get('limit', 100))

        # Base queryset
        queryset = UserLevel.objects.select_related('user')

        # Apply time period filter
        if period == 'daily':
            date_filter = timezone.now().date()
            queryset = queryset.filter(last_activity_date=date_filter)
        elif period == 'weekly':
            week_ago = timezone.now().date() - timedelta(days=7)
            queryset = queryset.filter(last_activity_date__gte=week_ago)
        elif period == 'monthly':
            month_ago = timezone.now().date() - timedelta(days=30)
            queryset = queryset.filter(last_activity_date__gte=month_ago)

        # Apply scope filter
        if scope == 'branch' and hasattr(request.user, 'student_branch'):
            # Filter by user's branch
            queryset = queryset.filter(user__student_branch=request.user.student_branch)

        # Order by type
        if leaderboard_type == 'xp':
            queryset = queryset.order_by('-total_xp')
        elif leaderboard_type == 'level':
            queryset = queryset.order_by('-current_level', '-total_xp')
        elif leaderboard_type == 'streak':
            queryset = queryset.order_by('-current_streak_days', '-longest_streak_days')

        # Limit results
        queryset = queryset[:limit]

        # Build leaderboard entries
        entries = []
        for rank, user_level in enumerate(queryset, start=1):
            badge_count = UserBadge.objects.filter(user=user_level.user).count()

            score_value = user_level.total_xp
            if leaderboard_type == 'level':
                score_value = user_level.current_level
            elif leaderboard_type == 'streak':
                score_value = user_level.current_streak_days

            entries.append({
                'rank': rank,
                'user_id': user_level.user.id,
                'username': user_level.user.username,
                'first_name': user_level.user.first_name,
                'photo': user_level.user.photo if hasattr(user_level.user, 'photo') else None,
                'score': score_value,
                'level': user_level.current_level,
                'badge_count': badge_count
            })

        serializer = LeaderboardEntrySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_rank(self, request):
        """Get current user's rank in different leaderboards"""
        user_level, created = UserLevel.objects.get_or_create(user=request.user)

        # Calculate XP rank
        xp_rank = UserLevel.objects.filter(total_xp__gt=user_level.total_xp).count() + 1

        # Calculate level rank
        level_rank = UserLevel.objects.filter(
            Q(current_level__gt=user_level.current_level) |
            Q(current_level=user_level.current_level, total_xp__gt=user_level.total_xp)
        ).count() + 1

        # Calculate streak rank
        streak_rank = UserLevel.objects.filter(
            current_streak_days__gt=user_level.current_streak_days
        ).count() + 1

        return Response({
            'xp_rank': xp_rank,
            'level_rank': level_rank,
            'streak_rank': streak_rank,
            'total_users': UserLevel.objects.count()
        })


class GamificationProfileViewSet(viewsets.ViewSet):
    """
    Complete gamification profile

    my_profile: Get full gamification data for current user
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserGamificationProfileSerializer
    queryset = UserLevel.objects.all()

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get complete gamification profile"""
        user = request.user

        # Get or create user level
        user_level, created = UserLevel.objects.get_or_create(user=user)

        # Assign daily challenges if needed
        assign_daily_challenges(user)

        # Gather all gamification data
        today = timezone.now().date()

        profile_data = {
            'level_info': UserLevelSerializer(user_level).data,
            'badges': UserBadgeSerializer(
                UserBadge.objects.filter(user=user).select_related('badge'),
                many=True
            ).data,
            'recent_xp': XPTransactionSerializer(
                XPTransaction.objects.filter(user=user)[:10],
                many=True
            ).data,
            'daily_challenges': UserDailyChallengeSerializer(
                UserDailyChallenge.objects.filter(
                    user=user,
                    date_assigned=today
                ).select_related('challenge'),
                many=True
            ).data,
            'achievements': UserAchievementSerializer(
                UserAchievement.objects.filter(user=user).select_related('achievement'),
                many=True
            ).data,
            'leaderboard_rank': UserLevel.objects.filter(
                total_xp__gt=user_level.total_xp
            ).count() + 1
        }

        return Response(profile_data)

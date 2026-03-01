"""
Gamification Models for EduVoice Platform

Features:
- Badge system
- XP & Leveling
- Daily challenges
- Achievements
- Leaderboards
- Streaks
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class BadgeType(models.TextChoices):
    """Types of badges available"""
    ACHIEVEMENT = 'achievement', _('Achievement')
    MILESTONE = 'milestone', _('Milestone')
    SPECIAL = 'special', _('Special')
    SEASONAL = 'seasonal', _('Seasonal')
    STREAK = 'streak', _('Streak')


class Badge(models.Model):
    """
    Badges that students can earn
    """
    name = models.CharField(max_length=100, verbose_name=_('Name'))
    name_uz = models.CharField(max_length=100, blank=True, verbose_name=_('Name (Uzbek)'))
    name_ru = models.CharField(max_length=100, blank=True, verbose_name=_('Name (Russian)'))

    description = models.TextField(verbose_name=_('Description'))
    description_uz = models.TextField(blank=True, verbose_name=_('Description (Uzbek)'))
    description_ru = models.TextField(blank=True, verbose_name=_('Description (Russian)'))

    icon = models.ImageField(upload_to='badges/', verbose_name=_('Icon'))
    badge_type = models.CharField(
        max_length=20,
        choices=BadgeType.choices,
        default=BadgeType.ACHIEVEMENT,
        verbose_name=_('Badge Type')
    )

    xp_reward = models.IntegerField(default=100, verbose_name=_('XP Reward'))
    coins_reward = models.IntegerField(default=10, verbose_name=_('Coins Reward'))

    rarity = models.CharField(
        max_length=20,
        choices=[
            ('common', _('Common')),
            ('uncommon', _('Uncommon')),
            ('rare', _('Rare')),
            ('epic', _('Epic')),
            ('legendary', _('Legendary'))
        ],
        default='common',
        verbose_name=_('Rarity')
    )

    # Criteria for earning the badge (JSON field for flexibility)
    criteria = models.JSONField(
        default=dict,
        help_text=_('Criteria for earning this badge (e.g., {"lessons_completed": 10})')
    )

    is_active = models.BooleanField(default=True, verbose_name=_('Is Active'))
    display_order = models.IntegerField(default=0, verbose_name=_('Display Order'))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', '-rarity', 'name']
        verbose_name = _('Badge')
        verbose_name_plural = _('Badges')

    def __str__(self):
        return f"{self.name} ({self.get_rarity_display()})"


class UserBadge(models.Model):
    """
    Badges earned by users
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='earned_badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='user_badges')

    earned_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Earned At'))
    is_showcased = models.BooleanField(default=False, verbose_name=_('Showcase on Profile'))

    # Optional: Track how the badge was earned
    earned_for = models.TextField(blank=True, verbose_name=_('Earned For'))

    class Meta:
        unique_together = ['user', 'badge']
        ordering = ['-earned_at']
        verbose_name = _('User Badge')
        verbose_name_plural = _('User Badges')

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"


class UserLevel(models.Model):
    """
    User XP and Level tracking
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='level_progress')

    total_xp = models.IntegerField(default=0, verbose_name=_('Total XP'))
    current_level = models.IntegerField(default=1, verbose_name=_('Current Level'))
    xp_to_next_level = models.IntegerField(default=100, verbose_name=_('XP to Next Level'))

    # Streak tracking
    current_streak_days = models.IntegerField(default=0, verbose_name=_('Current Streak (Days)'))
    longest_streak_days = models.IntegerField(default=0, verbose_name=_('Longest Streak (Days)'))
    last_activity_date = models.DateField(null=True, blank=True, verbose_name=_('Last Activity Date'))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('User Level')
        verbose_name_plural = _('User Levels')

    def __str__(self):
        return f"{self.user.username} - Level {self.current_level}"

    def add_xp(self, amount, reason=""):
        """Add XP and handle level ups"""
        self.total_xp += amount

        # Check for level up
        while self.total_xp >= self.xp_to_next_level:
            self.total_xp -= self.xp_to_next_level
            self.current_level += 1
            # Formula: each level requires 10% more XP
            self.xp_to_next_level = int(self.xp_to_next_level * 1.1)

            # Create XP transaction record
            XPTransaction.objects.create(
                user=self.user,
                amount=0,  # Level up doesn't give XP, but we track it
                transaction_type='level_up',
                reason=f"Reached level {self.current_level}",
                new_balance=self.total_xp
            )

        self.save()

        # Record the XP transaction
        XPTransaction.objects.create(
            user=self.user,
            amount=amount,
            transaction_type='earn',
            reason=reason,
            new_balance=self.total_xp
        )

        return self.current_level

    def update_streak(self):
        """Update the user's streak based on activity"""
        today = timezone.now().date()

        if self.last_activity_date is None:
            # First time activity
            self.current_streak_days = 1
            self.longest_streak_days = 1
        elif self.last_activity_date == today:
            # Already updated today, no change
            return
        elif self.last_activity_date == today - timedelta(days=1):
            # Continuing streak
            self.current_streak_days += 1
            self.longest_streak_days = max(self.longest_streak_days, self.current_streak_days)
        else:
            # Streak broken
            self.current_streak_days = 1

        self.last_activity_date = today
        self.save()


class XPTransaction(models.Model):
    """
    Track all XP transactions for audit and analytics
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='xp_transactions')
    amount = models.IntegerField(verbose_name=_('Amount'))
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('earn', _('Earn')),
            ('bonus', _('Bonus')),
            ('level_up', _('Level Up')),
            ('penalty', _('Penalty'))
        ],
        default='earn'
    )
    reason = models.CharField(max_length=255, verbose_name=_('Reason'))
    new_balance = models.IntegerField(verbose_name=_('New Balance'))

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('XP Transaction')
        verbose_name_plural = _('XP Transactions')

    def __str__(self):
        return f"{self.user.username} - {self.amount} XP ({self.reason})"


class DailyChallenge(models.Model):
    """
    Daily challenges for students
    """
    title = models.CharField(max_length=200, verbose_name=_('Title'))
    title_uz = models.CharField(max_length=200, blank=True)
    title_ru = models.CharField(max_length=200, blank=True)

    description = models.TextField(verbose_name=_('Description'))
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)

    challenge_type = models.CharField(
        max_length=30,
        choices=[
            ('lessons', _('Complete Lessons')),
            ('quiz', _('Take Quizzes')),
            ('study_time', _('Study Time')),
            ('perfect_score', _('Perfect Score')),
            ('social', _('Social Interaction')),
            ('streak', _('Maintain Streak'))
        ],
        verbose_name=_('Challenge Type')
    )

    target_value = models.IntegerField(
        verbose_name=_('Target Value'),
        help_text=_('The goal to achieve (e.g., 5 lessons, 30 minutes)')
    )

    xp_reward = models.IntegerField(default=50, verbose_name=_('XP Reward'))
    coins_reward = models.IntegerField(default=5, verbose_name=_('Coins Reward'))

    is_active = models.BooleanField(default=True, verbose_name=_('Is Active'))

    # Rotation settings
    available_days = models.CharField(
        max_length=13,
        default='1234567',
        help_text=_('Days of week (1=Monday, 7=Sunday)')
    )

    difficulty = models.CharField(
        max_length=10,
        choices=[
            ('easy', _('Easy')),
            ('medium', _('Medium')),
            ('hard', _('Hard'))
        ],
        default='medium'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['difficulty', 'title']
        verbose_name = _('Daily Challenge')
        verbose_name_plural = _('Daily Challenges')

    def __str__(self):
        return f"{self.title} ({self.get_difficulty_display()})"


class UserDailyChallenge(models.Model):
    """
    Track user progress on daily challenges
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_challenges')
    challenge = models.ForeignKey(DailyChallenge, on_delete=models.CASCADE)

    date_assigned = models.DateField(default=timezone.now, verbose_name=_('Date Assigned'))
    current_progress = models.IntegerField(default=0, verbose_name=_('Current Progress'))
    is_completed = models.BooleanField(default=False, verbose_name=_('Is Completed'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Completed At'))

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'challenge', 'date_assigned']
        ordering = ['-date_assigned', '-is_completed']
        verbose_name = _('User Daily Challenge')
        verbose_name_plural = _('User Daily Challenges')
        indexes = [
            models.Index(fields=['user', 'date_assigned', 'is_completed']),
        ]

    def __str__(self):
        status = "Completed" if self.is_completed else f"{self.current_progress}/{self.challenge.target_value}"
        return f"{self.user.username} - {self.challenge.title} ({status})"

    def update_progress(self, increment=1):
        """Update challenge progress"""
        if self.is_completed:
            return False

        self.current_progress += increment

        if self.current_progress >= self.challenge.target_value:
            self.is_completed = True
            self.completed_at = timezone.now()

            # Award rewards
            user_level, created = UserLevel.objects.get_or_create(user=self.user)
            user_level.add_xp(
                self.challenge.xp_reward,
                reason=f"Completed daily challenge: {self.challenge.title}"
            )

            if self.challenge.coins_reward > 0:
                from student_profile.services.coin_wallet import credit_student_coins

                credit_student_coins(
                    self.user,
                    self.challenge.coins_reward,
                    f"Daily challenge reward: {self.challenge.title}"
                )

        self.save()
        return True


class Achievement(models.Model):
    """
    Long-term achievements (more complex than badges)
    """
    name = models.CharField(max_length=100, verbose_name=_('Name'))
    name_uz = models.CharField(max_length=100, blank=True)
    name_ru = models.CharField(max_length=100, blank=True)

    description = models.TextField(verbose_name=_('Description'))
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)

    icon = models.ImageField(upload_to='achievements/', verbose_name=_('Icon'))

    # Multi-tier achievements
    tiers = models.JSONField(
        default=list,
        help_text=_('List of tiers with requirements, e.g., [{"level": 1, "requirement": 10, "xp": 100}, ...]')
    )

    category = models.CharField(
        max_length=30,
        choices=[
            ('learning', _('Learning')),
            ('social', _('Social')),
            ('competitive', _('Competitive')),
            ('creative', _('Creative')),
            ('supporter', _('Supporter'))
        ],
        default='learning'
    )

    is_secret = models.BooleanField(default=False, verbose_name=_('Is Secret'))
    is_active = models.BooleanField(default=True, verbose_name=_('Is Active'))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = _('Achievement')
        verbose_name_plural = _('Achievements')

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class UserAchievement(models.Model):
    """
    Achievements earned by users
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)

    current_tier = models.IntegerField(default=0, verbose_name=_('Current Tier'))
    progress = models.IntegerField(default=0, verbose_name=_('Progress'))

    unlocked_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Unlocked At'))
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'achievement']
        ordering = ['-current_tier', '-progress']
        verbose_name = _('User Achievement')
        verbose_name_plural = _('User Achievements')

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name} (Tier {self.current_tier})"


class Leaderboard(models.Model):
    """
    Different types of leaderboards
    """
    name = models.CharField(max_length=100, verbose_name=_('Name'))
    leaderboard_type = models.CharField(
        max_length=20,
        choices=[
            ('xp', _('Total XP')),
            ('level', _('Level')),
            ('streak', _('Streak')),
            ('quiz_score', _('Quiz Score')),
            ('course_completion', _('Course Completion'))
        ]
    )

    scope = models.CharField(
        max_length=20,
        choices=[
            ('global', _('Global')),
            ('branch', _('Branch')),
            ('course', _('Course')),
            ('group', _('Group'))
        ],
        default='global'
    )

    time_period = models.CharField(
        max_length=20,
        choices=[
            ('all_time', _('All Time')),
            ('monthly', _('Monthly')),
            ('weekly', _('Weekly')),
            ('daily', _('Daily'))
        ],
        default='all_time'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Leaderboard')
        verbose_name_plural = _('Leaderboards')

    def __str__(self):
        return f"{self.name} ({self.get_leaderboard_type_display()})"

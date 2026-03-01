"""
Gamification Django Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Badge, UserBadge, UserLevel, XPTransaction,
    DailyChallenge, UserDailyChallenge,
    Achievement, UserAchievement, Leaderboard
)


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ['name', 'badge_type', 'rarity_colored', 'xp_reward', 'coins_reward', 'is_active']
    list_filter = ['badge_type', 'rarity', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['display_order', '-rarity']

    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'name_uz', 'name_ru', 'icon', 'badge_type', 'rarity', 'display_order')
        }),
        ('Description', {
            'fields': ('description', 'description_uz', 'description_ru')
        }),
        ('Rewards', {
            'fields': ('xp_reward', 'coins_reward')
        }),
        ('Criteria', {
            'fields': ('criteria',),
            'description': 'JSON format: {"slug": "badge_slug", "requirement": value}'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )

    def rarity_colored(self, obj):
        colors = {
            'common': '#808080',
            'uncommon': '#1eff00',
            'rare': '#0070dd',
            'epic': '#a335ee',
            'legendary': '#ff8000'
        }
        color = colors.get(obj.rarity, '#000000')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_rarity_display()
        )
    rarity_colored.short_description = 'Rarity'


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ['user', 'badge', 'earned_at', 'is_showcased']
    list_filter = ['is_showcased', 'earned_at', 'badge__badge_type']
    search_fields = ['user__username', 'user__first_name', 'badge__name']
    date_hierarchy = 'earned_at'
    readonly_fields = ['earned_at']


@admin.register(UserLevel)
class UserLevelAdmin(admin.ModelAdmin):
    list_display = ['user', 'current_level', 'total_xp', 'current_streak_days', 'last_activity_date']
    list_filter = ['current_level', 'current_streak_days']
    search_fields = ['user__username', 'user__first_name']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-total_xp']

    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Level & XP', {
            'fields': ('current_level', 'total_xp', 'xp_to_next_level')
        }),
        ('Streak', {
            'fields': ('current_streak_days', 'longest_streak_days', 'last_activity_date')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(XPTransaction)
class XPTransactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'transaction_type', 'reason', 'new_balance', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['user__username', 'reason']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
    ordering = ['-created_at']


@admin.register(DailyChallenge)
class DailyChallengeAdmin(admin.ModelAdmin):
    list_display = ['title', 'challenge_type', 'target_value', 'difficulty', 'xp_reward', 'is_active']
    list_filter = ['challenge_type', 'difficulty', 'is_active']
    search_fields = ['title', 'description']

    fieldsets = (
        ('Title', {
            'fields': ('title', 'title_uz', 'title_ru')
        }),
        ('Description', {
            'fields': ('description', 'description_uz', 'description_ru')
        }),
        ('Challenge Settings', {
            'fields': ('challenge_type', 'target_value', 'difficulty')
        }),
        ('Rewards', {
            'fields': ('xp_reward', 'coins_reward')
        }),
        ('Rotation', {
            'fields': ('available_days', 'is_active'),
            'description': 'Days: 1=Monday, 7=Sunday (e.g., "1234567" for all days)'
        }),
    )


@admin.register(UserDailyChallenge)
class UserDailyChallengeAdmin(admin.ModelAdmin):
    list_display = ['user', 'challenge', 'date_assigned', 'progress_bar', 'is_completed']
    list_filter = ['is_completed', 'date_assigned', 'challenge__challenge_type']
    search_fields = ['user__username', 'challenge__title']
    date_hierarchy = 'date_assigned'
    readonly_fields = ['completed_at', 'created_at']

    def progress_bar(self, obj):
        percentage = (obj.current_progress / obj.challenge.target_value) * 100 if obj.challenge.target_value > 0 else 0
        percentage = min(percentage, 100)
        color = '#4caf50' if obj.is_completed else '#2196f3'
        return format_html(
            '<div style="width:100px; background:#ddd; border-radius:3px;">'
            '<div style="width:{}px; background:{}; height:20px; border-radius:3px; text-align:center; color:white; font-size:10px; line-height:20px;">{:.0f}%</div>'
            '</div>',
            percentage,
            color,
            percentage
        )
    progress_bar.short_description = 'Progress'


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_secret', 'is_active']
    list_filter = ['category', 'is_secret', 'is_active']
    search_fields = ['name', 'description']

    fieldsets = (
        ('Name', {
            'fields': ('name', 'name_uz', 'name_ru')
        }),
        ('Description', {
            'fields': ('description', 'description_uz', 'description_ru')
        }),
        ('Settings', {
            'fields': ('icon', 'category', 'is_secret', 'is_active')
        }),
        ('Tiers', {
            'fields': ('tiers',),
            'description': 'JSON format: [{"level": 1, "requirement": 10, "xp": 100}, ...]'
        }),
    )


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ['user', 'achievement', 'current_tier', 'progress', 'unlocked_at']
    list_filter = ['current_tier', 'achievement__category', 'unlocked_at']
    search_fields = ['user__username', 'achievement__name']
    readonly_fields = ['unlocked_at', 'last_updated']


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ['name', 'leaderboard_type', 'scope', 'time_period', 'is_active']
    list_filter = ['leaderboard_type', 'scope', 'time_period', 'is_active']
    search_fields = ['name']

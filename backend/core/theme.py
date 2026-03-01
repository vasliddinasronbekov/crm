"""
Theme Management System
=======================
Backend utilities for managing user theme preferences

Features:
- Store user theme preferences
- Theme detection from request
- API endpoints for theme switching
"""

from django.conf import settings
from typing import Literal, Optional
from rest_framework.request import Request

ThemeMode = Literal['light', 'dark', 'auto']

# Default theme if not specified
DEFAULT_THEME: ThemeMode = 'light'

# Available theme modes
AVAILABLE_THEMES: list[ThemeMode] = ['light', 'dark', 'auto']


def get_theme_from_request(request: Request) -> ThemeMode:
    """
    Get theme preference from request

    Priority:
    1. Query parameter: ?theme=dark
    2. User preference (if authenticated)
    3. Default: light

    Args:
        request: Django request object

    Returns:
        Theme mode: 'light', 'dark', or 'auto'
    """
    # 1. Check query parameter
    theme = request.GET.get('theme')
    if theme and theme in AVAILABLE_THEMES:
        return theme  # type: ignore

    # 2. Check user preference
    if hasattr(request, 'user') and request.user.is_authenticated:
        if hasattr(request.user, 'theme_preference'):
            user_theme = request.user.theme_preference
            if user_theme and user_theme in AVAILABLE_THEMES:
                return user_theme  # type: ignore

    # 3. Default
    return DEFAULT_THEME


def is_valid_theme(theme: str) -> bool:
    """Check if theme is valid"""
    return theme in AVAILABLE_THEMES


class ThemeHelper:
    """Helper for theme-related operations"""

    @staticmethod
    def get_available_themes() -> list[dict]:
        """Get list of available themes"""
        return [
            {
                'value': 'light',
                'label': 'Light',
                'icon': '☀️',
                'description': 'Light mode for daytime use'
            },
            {
                'value': 'dark',
                'label': 'Dark',
                'icon': '🌙',
                'description': 'Dark mode for nighttime use'
            },
            {
                'value': 'auto',
                'label': 'Auto',
                'icon': '⚙️',
                'description': 'Follow system preference'
            }
        ]

    @staticmethod
    def save_user_theme(user, theme: ThemeMode) -> bool:
        """
        Save user theme preference

        Args:
            user: User instance
            theme: Theme mode to save

        Returns:
            True if saved successfully
        """
        if not is_valid_theme(theme):
            return False

        try:
            user.theme_preference = theme
            user.save(update_fields=['theme_preference'])
            return True
        except Exception:
            return False


# Export
__all__ = [
    'ThemeMode',
    'DEFAULT_THEME',
    'AVAILABLE_THEMES',
    'get_theme_from_request',
    'is_valid_theme',
    'ThemeHelper',
]

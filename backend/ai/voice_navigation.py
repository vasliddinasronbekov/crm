"""
Voice Navigation System - Hands-Free App Control

Enables users to navigate and control the app using voice commands.

Commands:
- "Open dashboard" -> Navigate to dashboard
- "Show my schedule" -> Navigate to schedule page
- "Check payments" -> Navigate to payments page
- "Send message to teacher" -> Open messaging with teacher
- "Go back" -> Navigate back
- "Search for [query]" -> Perform search
"""
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NavigationAction:
    """Navigation action definition."""
    action_type: str  # 'navigate', 'open', 'execute', 'search'
    target: str  # Screen/page to navigate to
    params: Optional[Dict[str, Any]] = None
    confirmation_required: bool = False
    success_message: str = ""


class VoiceNavigationHandler:
    """
    Handles voice navigation commands and translates them to app actions.
    """

    # Navigation patterns (multilingual)
    NAVIGATION_PATTERNS = {
        # Dashboard
        'dashboard': {
            'patterns': [
                'open dashboard', 'show dashboard', 'go to dashboard',
                'dashboard ochish', 'boshqaruv paneli', 'dashboard ko\'rsat',
                'открой дашборд', 'покажи дашборд'
            ],
            'screen': 'dashboard',
            'message': 'Opening dashboard / Dashboard ochilmoqda'
        },

        # Schedule
        'schedule': {
            'patterns': [
                'show schedule', 'my schedule', 'class schedule', 'view schedule',
                'dars jadvali', 'jadvalim', 'dars jadvali ko\'rsat',
                'расписание', 'покажи расписание', 'мое расписание'
            ],
            'screen': 'schedule',
            'message': 'Opening schedule / Jadval ochilmoqda'
        },

        # Payments
        'payments': {
            'patterns': [
                'check payments', 'payment history', 'my payments', 'view payments',
                'to\'lovlar', 'to\'lov tarixi', 'to\'lovlarim ko\'rsat',
                'платежи', 'мои платежи', 'проверить платежи'
            ],
            'screen': 'payments',
            'message': 'Opening payments / To\'lovlar ochilmoqda'
        },

        # Balance
        'balance': {
            'patterns': [
                'check balance', 'my balance', 'account balance', 'show balance',
                'balans', 'hisobim', 'balansni ko\'rsat',
                'баланс', 'мой баланс', 'проверить баланс'
            ],
            'screen': 'balance',
            'message': 'Checking balance / Balans tekshirilmoqda'
        },

        # Messages
        'messages': {
            'patterns': [
                'messages', 'show messages', 'my messages', 'inbox',
                'xabarlar', 'xabarlarim', 'xabarlar ko\'rsat',
                'сообщения', 'мои сообщения', 'показать сообщения'
            ],
            'screen': 'messages',
            'message': 'Opening messages / Xabarlar ochilmoqda'
        },

        # Profile
        'profile': {
            'patterns': [
                'my profile', 'view profile', 'show profile', 'profile settings',
                'profilim', 'profil', 'profil ko\'rsat',
                'профиль', 'мой профиль', 'показать профиль'
            ],
            'screen': 'profile',
            'message': 'Opening profile / Profil ochilmoqda'
        },

        # Grades
        'grades': {
            'patterns': [
                'my grades', 'check grades', 'view grades', 'exam results',
                'baholarim', 'baholar', 'baholar ko\'rsat', 'imtihon natijalari',
                'оценки', 'мои оценки', 'результаты экзаменов'
            ],
            'screen': 'grades',
            'message': 'Opening grades / Baholar ochilmoqda'
        },

        # Attendance
        'attendance': {
            'patterns': [
                'attendance', 'my attendance', 'check attendance', 'attendance record',
                'davomat', 'davomatim', 'davomat ko\'rsat',
                'посещаемость', 'моя посещаемость'
            ],
            'screen': 'attendance',
            'message': 'Opening attendance / Davomat ochilmoqda'
        },

        # Courses
        'courses': {
            'patterns': [
                'my courses', 'view courses', 'course list', 'enrolled courses',
                'kurslarim', 'kurslar', 'kurslar ro\'yxati',
                'курсы', 'мои курсы', 'список курсов'
            ],
            'screen': 'courses',
            'message': 'Opening courses / Kurslar ochilmoqda'
        },

        # Assignments
        'assignments': {
            'patterns': [
                'assignments', 'homework', 'my tasks', 'pending assignments',
                'topshiriqlar', 'uy vazifasi', 'topshiriqlarim',
                'задания', 'домашнее задание', 'мои задания'
            ],
            'screen': 'assignments',
            'message': 'Opening assignments / Topshiriqlar ochilmoqda'
        },

        # Settings
        'settings': {
            'patterns': [
                'settings', 'open settings', 'app settings', 'preferences',
                'sozlamalar', 'sozlash', 'sozlamalar ochish',
                'настройки', 'открыть настройки'
            ],
            'screen': 'settings',
            'message': 'Opening settings / Sozlamalar ochilmoqda'
        },

        # Help
        'help': {
            'patterns': [
                'help', 'need help', 'show help', 'support',
                'yordam', 'yordam kerak', 'qo\'llab-quvvatlash',
                'помощь', 'нужна помощь', 'поддержка'
            ],
            'screen': 'help',
            'message': 'Opening help / Yordam ochilmoqda'
        },

        # Notifications
        'notifications': {
            'patterns': [
                'notifications', 'alerts', 'my notifications', 'show notifications',
                'bildirishnomalar', 'xabarnomalar', 'bildirishnomalarim',
                'уведомления', 'мои уведомления', 'оповещения'
            ],
            'screen': 'notifications',
            'message': 'Opening notifications / Bildirishnomalar ochilmoqda'
        },
    }

    # Navigation actions (not screens, but actions)
    ACTION_PATTERNS = {
        'go_back': {
            'patterns': [
                'go back', 'back', 'previous',
                'orqaga', 'qaytish', 'oldingi',
                'назад', 'вернуться'
            ],
            'action': 'navigate_back'
        },

        'refresh': {
            'patterns': [
                'refresh', 'reload', 'update',
                'yangilash', 'qayta yuklash',
                'обновить', 'перезагрузить'
            ],
            'action': 'refresh_page'
        },

        'logout': {
            'patterns': [
                'logout', 'sign out', 'exit',
                'chiqish', 'tizimdan chiqish',
                'выйти', 'выход'
            ],
            'action': 'logout',
            'confirmation_required': True
        },
    }

    def __init__(self):
        """Initialize navigation handler."""
        self.command_history = []

    def process_command(self, text: str, user: Any = None) -> NavigationAction:
        """
        Process voice navigation command.

        Args:
            text: Voice command text
            user: User object (for context)

        Returns:
            NavigationAction with target and params
        """
        text_lower = text.lower().strip()

        # Check for screen navigation
        for screen_key, config in self.NAVIGATION_PATTERNS.items():
            for pattern in config['patterns']:
                if pattern in text_lower:
                    return NavigationAction(
                        action_type='navigate',
                        target=config['screen'],
                        success_message=config['message']
                    )

        # Check for actions
        for action_key, config in self.ACTION_PATTERNS.items():
            for pattern in config['patterns']:
                if pattern in text_lower:
                    return NavigationAction(
                        action_type='execute',
                        target=config['action'],
                        confirmation_required=config.get('confirmation_required', False)
                    )

        # Check for search
        search_keywords = ['search', 'find', 'qidirish', 'topish', 'найти', 'искать']
        for keyword in search_keywords:
            if keyword in text_lower:
                # Extract search query
                query = self._extract_search_query(text, keyword)
                if query:
                    return NavigationAction(
                        action_type='search',
                        target='search',
                        params={'query': query},
                        success_message=f'Searching for "{query}"'
                    )

        # Check for "send message to"
        if 'send message' in text_lower or 'xabar yuborish' in text_lower or 'отправить сообщение' in text_lower:
            recipient = self._extract_recipient(text)
            return NavigationAction(
                action_type='navigate',
                target='compose_message',
                params={'recipient': recipient},
                success_message='Opening message composer'
            )

        # Unknown command
        return NavigationAction(
            action_type='unknown',
            target='',
            success_message='Command not recognized. Please try again.'
        )

    def _extract_search_query(self, text: str, keyword: str) -> Optional[str]:
        """Extract search query from command."""
        text_lower = text.lower()
        if keyword not in text_lower:
            return None

        # Get text after keyword
        parts = text_lower.split(keyword, 1)
        if len(parts) > 1:
            query = parts[1].strip()
            # Remove common words
            query = query.replace('for', '').replace('uchun', '').replace('для', '').strip()
            return query if query else None
        return None

    def _extract_recipient(self, text: str) -> Optional[str]:
        """Extract message recipient from command."""
        # Simple extraction - look for "to [name]"
        text_lower = text.lower()

        for separator in [' to ', ' uchun ', ' для ']:
            if separator in text_lower:
                parts = text_lower.split(separator, 1)
                if len(parts) > 1:
                    return parts[1].strip()

        return None

    def get_available_commands(self, language: str = 'en') -> List[str]:
        """
        Get list of available voice commands.

        Args:
            language: Language code ('en', 'uz', 'ru')

        Returns:
            List of example commands
        """
        commands = []

        # Navigation commands
        for screen_key, config in self.NAVIGATION_PATTERNS.items():
            # Get first pattern for specified language
            pattern = self._get_localized_pattern(config['patterns'], language)
            if pattern:
                commands.append(f'"{pattern}"')

        # Action commands
        for action_key, config in self.ACTION_PATTERNS.items():
            pattern = self._get_localized_pattern(config['patterns'], language)
            if pattern:
                commands.append(f'"{pattern}"')

        return commands

    def _get_localized_pattern(self, patterns: List[str], language: str) -> Optional[str]:
        """Get pattern in specified language."""
        if language == 'en':
            # Return first English pattern
            for p in patterns:
                if any(c.isascii() for c in p):
                    return p
        elif language == 'uz':
            # Return first Uzbek pattern
            for p in patterns:
                if any(word in p for word in ['ochish', 'ko\'rsat', 'uchun']):
                    return p
        elif language == 'ru':
            # Return first Russian pattern
            for p in patterns:
                if any(ord(c) > 1000 for c in p):  # Cyrillic
                    return p

        # Fallback to first pattern
        return patterns[0] if patterns else None


# Global instance
_voice_nav_handler = None


def get_voice_navigation_handler() -> VoiceNavigationHandler:
    """Get or create global voice navigation handler."""
    global _voice_nav_handler
    if _voice_nav_handler is None:
        _voice_nav_handler = VoiceNavigationHandler()
    return _voice_nav_handler


def process_navigation_command(text: str, user: Any = None) -> dict:
    """
    Convenient function to process navigation command.

    Args:
        text: Voice command
        user: User object

    Returns:
        Dict with action details
    """
    handler = get_voice_navigation_handler()
    action = handler.process_command(text, user)

    return {
        'action_type': action.action_type,
        'target': action.target,
        'params': action.params or {},
        'confirmation_required': action.confirmation_required,
        'message': action.success_message
    }


def get_voice_commands(language: str = 'en') -> List[str]:
    """
    Get list of available voice commands.

    Args:
        language: Language code

    Returns:
        List of example commands
    """
    handler = get_voice_navigation_handler()
    return handler.get_available_commands(language)

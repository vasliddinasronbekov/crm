"""
Internationalization (i18n) Utilities
=====================================
Utilities for handling translations across the platform

Features:
- Language detection from request
- Translation helpers
- Common translations
- Multi-language response formatting
"""

from django.utils.translation import gettext as _, activate, get_language
from django.conf import settings
from typing import Dict, Any, Optional
from rest_framework.request import Request

# =============================================================================
# LANGUAGE DETECTION
# =============================================================================

def get_language_from_request(request: Request) -> str:
    """
    Get language from request

    Priority:
    1. Query parameter: ?lang=uz
    2. Header: Accept-Language
    3. User preference (if authenticated)
    4. Default: uz
    """
    # 1. Check query parameter
    lang = request.GET.get('lang') or request.GET.get('language')
    if lang and lang in [code for code, name in settings.LANGUAGES]:
        return lang

    # 2. Check header
    accept_lang = request.META.get('HTTP_ACCEPT_LANGUAGE', '')
    if accept_lang:
        # Parse Accept-Language header (e.g., "en-US,en;q=0.9,uz;q=0.8")
        for lang_part in accept_lang.split(','):
            lang_code = lang_part.split(';')[0].strip()[:2]
            if lang_code in [code for code, name in settings.LANGUAGES]:
                return lang_code

    # 3. Check user preference
    if hasattr(request, 'user') and request.user.is_authenticated:
        if hasattr(request.user, 'language_preference'):
            return request.user.language_preference or settings.LANGUAGE_CODE

    # 4. Default
    return settings.LANGUAGE_CODE

def activate_language_from_request(request: Request) -> str:
    """
    Activate language based on request and return the language code
    """
    lang_code = get_language_from_request(request)
    activate(lang_code)
    return lang_code

# =============================================================================
# TRANSLATION HELPERS
# =============================================================================

class TranslationHelper:
    """Helper class for common translations"""

    @staticmethod
    def get_success_message(action: str = 'saved') -> str:
        """Get success message for common actions"""
        messages = {
            'saved': _('Successfully saved'),
            'created': _('Successfully created'),
            'updated': _('Successfully updated'),
            'deleted': _('Successfully deleted'),
            'sent': _('Successfully sent'),
            'completed': _('Successfully completed'),
        }
        return messages.get(action, _('Operation successful'))

    @staticmethod
    def get_error_message(error_type: str = 'general') -> str:
        """Get error message for common errors"""
        messages = {
            'general': _('An error occurred'),
            'not_found': _('Not found'),
            'permission': _('Permission denied'),
            'invalid': _('Invalid data'),
            'required': _('This field is required'),
            'exists': _('Already exists'),
            'auth': _('Authentication required'),
        }
        return messages.get(error_type, _('An error occurred'))

    @staticmethod
    def get_validation_message(validation_type: str) -> str:
        """Get validation error messages"""
        messages = {
            'email': _('Invalid email address'),
            'phone': _('Invalid phone number'),
            'password': _('Password is too weak'),
            'length': _('Length is invalid'),
            'format': _('Invalid format'),
        }
        return messages.get(validation_type, _('Validation failed'))

# =============================================================================
# COMMON TRANSLATIONS
# =============================================================================

class CommonTranslations:
    """
    Common translations used across the platform
    Organized by category
    """

    # General
    GENERAL = {
        'yes': _('Yes'),
        'no': _('No'),
        'ok': _('OK'),
        'cancel': _('Cancel'),
        'save': _('Save'),
        'delete': _('Delete'),
        'edit': _('Edit'),
        'create': _('Create'),
        'update': _('Update'),
        'submit': _('Submit'),
        'back': _('Back'),
        'next': _('Next'),
        'previous': _('Previous'),
        'close': _('Close'),
        'search': _('Search'),
        'filter': _('Filter'),
        'loading': _('Loading...'),
        'no_data': _('No data available'),
    }

    # User/Auth
    AUTH = {
        'login': _('Login'),
        'logout': _('Logout'),
        'register': _('Register'),
        'email': _('Email'),
        'password': _('Password'),
        'username': _('Username'),
        'first_name': _('First Name'),
        'last_name': _('Last Name'),
        'phone': _('Phone Number'),
        'profile': _('Profile'),
        'settings': _('Settings'),
    }

    # Student
    STUDENT = {
        'students': _('Students'),
        'student': _('Student'),
        'enrollment': _('Enrollment'),
        'schedule': _('Schedule'),
        'courses': _('Courses'),
        'progress': _('Progress'),
        'grades': _('Grades'),
        'attendance': _('Attendance'),
        'assignments': _('Assignments'),
        'exams': _('Exams'),
    }

    # Course
    COURSE = {
        'course': _('Course'),
        'courses': _('Courses'),
        'lesson': _('Lesson'),
        'lessons': _('Lessons'),
        'module': _('Module'),
        'modules': _('Modules'),
        'instructor': _('Instructor'),
        'syllabus': _('Syllabus'),
        'duration': _('Duration'),
        'price': _('Price'),
        'start_date': _('Start Date'),
        'end_date': _('End Date'),
    }

    # Payment
    PAYMENT = {
        'payment': _('Payment'),
        'payments': _('Payments'),
        'balance': _('Balance'),
        'amount': _('Amount'),
        'paid': _('Paid'),
        'unpaid': _('Unpaid'),
        'invoice': _('Invoice'),
        'receipt': _('Receipt'),
        'discount': _('Discount'),
        'total': _('Total'),
    }

    # Time
    TIME = {
        'today': _('Today'),
        'yesterday': _('Yesterday'),
        'tomorrow': _('Tomorrow'),
        'week': _('Week'),
        'month': _('Month'),
        'year': _('Year'),
        'date': _('Date'),
        'time': _('Time'),
        'from': _('From'),
        'to': _('To'),
    }

    # Status
    STATUS = {
        'active': _('Active'),
        'inactive': _('Inactive'),
        'pending': _('Pending'),
        'completed': _('Completed'),
        'cancelled': _('Cancelled'),
        'approved': _('Approved'),
        'rejected': _('Rejected'),
    }

# =============================================================================
# RESPONSE FORMATTERS
# =============================================================================

def format_multilingual_response(
    data: Any,
    message: str = None,
    status: str = 'success',
    language: str = None
) -> Dict[str, Any]:
    """
    Format API response with language metadata

    Args:
        data: Response data
        message: Response message (will be translated)
        status: Response status (success/error)
        language: Language code (auto-detected if None)

    Returns:
        Formatted response dict
    """
    if language:
        activate(language)

    current_lang = get_language()

    response = {
        'status': status,
        'data': data,
        'language': current_lang,
    }

    if message:
        response['message'] = _(message)

    return response

def get_translated_field(
    obj: Any,
    field_name: str,
    language: str = None,
    fallback: bool = True
) -> str:
    """
    Get translated field value from model

    For models with translation fields like:
    - title_uz, title_ru, title_en
    - description_uz, description_ru, description_en

    Args:
        obj: Model instance
        field_name: Base field name (e.g., 'title')
        language: Language code (current language if None)
        fallback: Fall back to other languages if not found

    Returns:
        Translated field value
    """
    if language is None:
        language = get_language()

    # Try requested language
    field = f"{field_name}_{language}"
    value = getattr(obj, field, None)

    if value:
        return value

    if not fallback:
        return ''

    # Fallback to other languages
    for lang_code, lang_name in settings.LANGUAGES:
        field = f"{field_name}_{lang_code}"
        value = getattr(obj, field, None)
        if value:
            return value

    # Last resort: try base field
    return getattr(obj, field_name, '')

# =============================================================================
# LANGUAGE SWITCHER
# =============================================================================

class LanguageSwitcher:
    """Utility for switching languages in views"""

    @staticmethod
    def get_available_languages() -> list:
        """Get list of available languages"""
        return [
            {'code': code, 'name': str(name)}
            for code, name in settings.LANGUAGES
        ]

    @staticmethod
    def is_valid_language(lang_code: str) -> bool:
        """Check if language code is valid"""
        return lang_code in [code for code, name in settings.LANGUAGES]

    @staticmethod
    def get_language_name(lang_code: str) -> str:
        """Get language name from code"""
        for code, name in settings.LANGUAGES:
            if code == lang_code:
                return str(name)
        return lang_code

# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    'get_language_from_request',
    'activate_language_from_request',
    'TranslationHelper',
    'CommonTranslations',
    'format_multilingual_response',
    'get_translated_field',
    'LanguageSwitcher',
]

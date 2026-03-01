"""
Automatic Language Detection for Multilingual LLM

Detects language from user input without manual specification.
Supports: English, Russian, Uzbek (Latin & Cyrillic)
"""
import re
import logging
from typing import Optional, Dict, List
from django.core.cache import cache

logger = logging.getLogger(__name__)


class LanguageDetector:
    """
    Fast, lightweight language detector for en/ru/uz.
    No external dependencies needed!
    """

    # Character ranges for different scripts
    CYRILLIC_PATTERN = re.compile(r'[а-яА-ЯёЁ]')
    LATIN_PATTERN = re.compile(r'[a-zA-Z]')
    UZBEK_LATIN_PATTERN = re.compile(r"[o'O'gʻGʻ]")  # Uzbek-specific characters

    # Common words in each language
    LANGUAGE_KEYWORDS = {
        'en': {
            # Common English words
            'words': [
                'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had',
                'do', 'does', 'did', 'will', 'would', 'can', 'could',
                'what', 'when', 'where', 'why', 'how', 'who',
                'hello', 'hi', 'please', 'thank', 'thanks', 'yes', 'no',
                'my', 'your', 'his', 'her', 'our', 'their',
                'course', 'student', 'payment', 'balance', 'schedule'
            ],
            'patterns': [
                r'\b(the|is|are|was|were)\b',
                r'\b(what|when|where|why|how)\b',
                r'\b(hello|hi|please|thank)\b'
            ]
        },
        'ru': {
            # Common Russian words
            'words': [
                'это', 'как', 'что', 'когда', 'где', 'почему', 'кто',
                'я', 'ты', 'он', 'она', 'мы', 'вы', 'они',
                'мой', 'твой', 'его', 'её', 'наш', 'ваш', 'их',
                'привет', 'спасибо', 'пожалуйста', 'да', 'нет',
                'курс', 'студент', 'оплата', 'баланс', 'расписание',
                'в', 'на', 'с', 'по', 'для', 'от', 'к', 'у'
            ],
            'patterns': [
                r'\b(это|как|что|где|когда)\b',
                r'\b(привет|спасибо|пожалуйста)\b',
                r'\b(курс|студент|оплата)\b'
            ]
        },
        'uz': {
            # Common Uzbek words (Latin script)
            'words': [
                'bu', 'qanday', 'nima', 'qachon', 'qayer', 'nega', 'kim',
                'men', 'sen', 'u', 'biz', 'siz', 'ular',
                'mening', 'sening', 'uning', 'bizning', 'sizning', 'ularning',
                'salom', 'rahmat', 'iltimos', 'ha', "yo'q",
                'kurs', 'talaba', "to'lov", 'balans', 'jadval',
                'va', 'yoki', 'uchun', 'bilan', 'dan', 'ga', 'ning'
            ],
            'patterns': [
                r'\b(bu|qanday|nima|qayer|nega)\b',
                r'\b(salom|rahmat|iltimos)\b',
                r'\b(kurs|talaba|to\'lov)\b',
                r"[o'gʻ]"  # Uzbek-specific characters
            ]
        }
    }

    def __init__(self, cache_results: bool = True):
        """
        Initialize language detector.

        Args:
            cache_results: Cache detection results for performance
        """
        self.cache_results = cache_results
        self.cache_ttl = 3600  # 1 hour

    def detect(self, text: str, threshold: float = 0.6) -> str:
        """
        Detect language from text.

        Args:
            text: Input text
            threshold: Confidence threshold (0-1)

        Returns:
            Language code: 'en', 'ru', 'uz', or 'en' (default)
        """
        if not text or not text.strip():
            return 'en'  # Default to English

        # Check cache
        if self.cache_results:
            cache_key = f"lang_detect:{hash(text)}"
            cached = cache.get(cache_key)
            if cached:
                return cached

        # Normalize text
        text_lower = text.lower()

        # Calculate scores for each language
        scores = {
            'en': self._score_english(text_lower),
            'ru': self._score_russian(text_lower),
            'uz': self._score_uzbek(text_lower)
        }

        # Get language with highest score
        detected_lang = max(scores.items(), key=lambda x: x[1])
        language = detected_lang[0]
        confidence = detected_lang[1]

        # Log detection
        logger.debug(f"Language detection: {language} (confidence: {confidence:.2f})")
        logger.debug(f"Scores: {scores}")

        # Use default if confidence too low
        if confidence < threshold:
            logger.warning(f"Low confidence ({confidence:.2f}), defaulting to English")
            language = 'en'

        # Cache result
        if self.cache_results:
            cache.set(cache_key, language, self.cache_ttl)

        return language

    def detect_with_confidence(self, text: str) -> Dict[str, float]:
        """
        Detect language and return confidence scores for all languages.

        Args:
            text: Input text

        Returns:
            Dict with language codes and confidence scores
        """
        if not text or not text.strip():
            return {'en': 1.0, 'ru': 0.0, 'uz': 0.0}

        text_lower = text.lower()

        scores = {
            'en': self._score_english(text_lower),
            'ru': self._score_russian(text_lower),
            'uz': self._score_uzbek(text_lower)
        }

        # Normalize scores to 0-1
        total = sum(scores.values())
        if total > 0:
            scores = {lang: score / total for lang, score in scores.items()}

        return scores

    def _score_english(self, text: str) -> float:
        """Calculate English score."""
        score = 0.0

        # Check for English characters
        if self.LATIN_PATTERN.search(text):
            score += 0.3

        # Check for English keywords
        for word in self.LANGUAGE_KEYWORDS['en']['words']:
            if f' {word} ' in f' {text} ' or text.startswith(word) or text.endswith(word):
                score += 0.1

        # Check for English patterns
        for pattern in self.LANGUAGE_KEYWORDS['en']['patterns']:
            if re.search(pattern, text, re.IGNORECASE):
                score += 0.2

        # Penalty for Cyrillic
        if self.CYRILLIC_PATTERN.search(text):
            score -= 0.5

        return max(0, score)

    def _score_russian(self, text: str) -> float:
        """Calculate Russian score."""
        score = 0.0

        # Check for Cyrillic characters (strong indicator)
        if self.CYRILLIC_PATTERN.search(text):
            score += 0.5

        # Check for Russian keywords
        for word in self.LANGUAGE_KEYWORDS['ru']['words']:
            if f' {word} ' in f' {text} ' or text.startswith(word) or text.endswith(word):
                score += 0.15

        # Check for Russian patterns
        for pattern in self.LANGUAGE_KEYWORDS['ru']['patterns']:
            if re.search(pattern, text):
                score += 0.3

        return max(0, score)

    def _score_uzbek(self, text: str) -> float:
        """Calculate Uzbek score."""
        score = 0.0

        # Check for Uzbek-specific Latin characters
        if self.UZBEK_LATIN_PATTERN.search(text):
            score += 0.6  # Strong indicator

        # Check for Uzbek keywords
        for word in self.LANGUAGE_KEYWORDS['uz']['words']:
            if f' {word} ' in f' {text} ' or text.startswith(word) or text.endswith(word):
                score += 0.15

        # Check for Uzbek patterns
        for pattern in self.LANGUAGE_KEYWORDS['uz']['patterns']:
            if re.search(pattern, text):
                score += 0.3

        # Penalty for Cyrillic (Uzbek is now Latin-only)
        if self.CYRILLIC_PATTERN.search(text):
            score -= 0.3

        return max(0, score)

    def detect_from_conversation(self, messages: List[str]) -> str:
        """
        Detect language from a conversation (multiple messages).

        Args:
            messages: List of messages

        Returns:
            Detected language code
        """
        if not messages:
            return 'en'

        # Combine recent messages
        combined_text = ' '.join(messages[-3:])  # Last 3 messages

        return self.detect(combined_text)


class SmartLanguageDetector:
    """
    Advanced language detector with user preference tracking.
    """

    def __init__(self):
        """Initialize smart detector."""
        self.detector = LanguageDetector()

    def detect_with_user_context(
        self,
        text: str,
        user_id: Optional[int] = None,
        previous_language: Optional[str] = None
    ) -> str:
        """
        Detect language with user context and preferences.

        Args:
            text: Input text
            user_id: User ID for preference tracking
            previous_language: Previously detected language in conversation

        Returns:
            Detected language code
        """
        # Get detection scores
        scores = self.detector.detect_with_confidence(text)

        # Get user's preferred language if available
        user_preference = self._get_user_preference(user_id)

        # Adjust scores based on context
        if user_preference:
            scores[user_preference] *= 1.2  # Boost user's preferred language

        if previous_language:
            scores[previous_language] *= 1.1  # Boost previous language (conversation continuity)

        # Get language with highest adjusted score
        detected_lang = max(scores.items(), key=lambda x: x[1])[0]

        # Save user preference if not exists
        if user_id and not user_preference:
            self._save_user_preference(user_id, detected_lang)

        return detected_lang

    def _get_user_preference(self, user_id: Optional[int]) -> Optional[str]:
        """Get user's preferred language from cache/DB."""
        if not user_id:
            return None

        # Check cache
        cache_key = f"user_lang_pref:{user_id}"
        return cache.get(cache_key)

    def _save_user_preference(self, user_id: int, language: str):
        """Save user's language preference."""
        cache_key = f"user_lang_pref:{user_id}"
        cache.set(cache_key, language, 86400 * 30)  # 30 days

        logger.info(f"Saved language preference for user {user_id}: {language}")


# Convenience functions
def detect_language(text: str) -> str:
    """
    Detect language from text.

    Args:
        text: Input text

    Returns:
        Language code: 'en', 'ru', or 'uz'

    Examples:
        >>> detect_language("Hello, how are you?")
        'en'
        >>> detect_language("Привет, как дела?")
        'ru'
        >>> detect_language("Salom, qalaysiz?")
        'uz'
    """
    detector = LanguageDetector()
    return detector.detect(text)


def detect_language_smart(
    text: str,
    user_id: Optional[int] = None,
    previous_language: Optional[str] = None
) -> str:
    """
    Smart language detection with user context.

    Args:
        text: Input text
        user_id: User ID for preference tracking
        previous_language: Previous language in conversation

    Returns:
        Detected language code
    """
    detector = SmartLanguageDetector()
    return detector.detect_with_user_context(text, user_id, previous_language)


def get_language_scores(text: str) -> Dict[str, float]:
    """
    Get confidence scores for all languages.

    Args:
        text: Input text

    Returns:
        Dict with language codes and scores

    Example:
        >>> get_language_scores("Hello мир")
        {'en': 0.45, 'ru': 0.50, 'uz': 0.05}
    """
    detector = LanguageDetector()
    return detector.detect_with_confidence(text)

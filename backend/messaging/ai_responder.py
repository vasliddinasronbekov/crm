"""
AI-Powered Message Auto-Responder

Features:
- Automatic message categorization
- Context-aware auto-responses
- FAQ handling
- Escalation detection
- Multilingual support
"""
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class MessageCategory(Enum):
    """Message categories for auto-response decision."""
    GREETING = "greeting"
    QUESTION = "question"
    INFO_REQUEST = "info_request"
    COMPLAINT = "complaint"
    PAYMENT_QUERY = "payment_query"
    SCHEDULE_QUERY = "schedule_query"
    GRADE_QUERY = "grade_query"
    TECHNICAL_ISSUE = "technical_issue"
    GENERAL = "general"
    NEEDS_HUMAN = "needs_human"


@dataclass
class MessageAnalysis:
    """Result of message analysis."""
    category: MessageCategory
    confidence: float
    language: str
    intent: Optional[str]
    entities: Dict
    should_auto_respond: bool
    urgency: str  # 'low', 'medium', 'high'


@dataclass
class AutoResponse:
    """Auto-generated response."""
    text: str
    category: MessageCategory
    confidence: float
    data: Optional[Dict] = None
    follow_up_suggestions: Optional[List[str]] = None


class AIMessageResponder:
    """
    AI-powered message auto-responder with intelligent categorization.
    """

    # FAQ patterns (multilingual)
    FAQ_PATTERNS = {
        'schedule': {
            'patterns': [
                'when is my class', 'class schedule', 'next class', 'class time',
                'dars vaqti', 'dars jadvali', 'keyingi dars',
                'расписание', 'когда урок', 'время занятий'
            ],
            'category': MessageCategory.SCHEDULE_QUERY,
            'can_auto_respond': True
        },

        'balance': {
            'patterns': [
                'my balance', 'how much', 'payment balance', 'account balance',
                'balansim', 'qancha', 'hisobim',
                'баланс', 'сколько', 'мой баланс'
            ],
            'category': MessageCategory.PAYMENT_QUERY,
            'can_auto_respond': True
        },

        'grades': {
            'patterns': [
                'my grades', 'exam results', 'test scores', 'how did i do',
                'baholarim', 'imtihon natijalari', 'test natijalari',
                'оценки', 'результаты', 'мои оценки'
            ],
            'category': MessageCategory.GRADE_QUERY,
            'can_auto_respond': True
        },

        'course_info': {
            'patterns': [
                'course information', 'what is', 'tell me about', 'course details',
                'kurs haqida', 'kurs ma\'lumoti', 'aytib bering',
                'информация о курсе', 'расскажите о', 'детали курса'
            ],
            'category': MessageCategory.INFO_REQUEST,
            'can_auto_respond': True
        },

        'payment_how': {
            'patterns': [
                'how to pay', 'payment method', 'how do i pay', 'payment process',
                'qanday to\'lash', 'to\'lov usuli', 'to\'lash jarayoni',
                'как оплатить', 'способ оплаты', 'процесс оплаты'
            ],
            'category': MessageCategory.PAYMENT_QUERY,
            'can_auto_respond': True
        },

        'technical': {
            'patterns': [
                'not working', 'error', 'bug', 'problem', 'issue', 'broken',
                'ishlamayapti', 'xato', 'muammo', 'nosozlik',
                'не работает', 'ошибка', 'проблема', 'не открывается'
            ],
            'category': MessageCategory.TECHNICAL_ISSUE,
            'can_auto_respond': False  # Escalate to support
        },

        'complaint': {
            'patterns': [
                'complaint', 'unhappy', 'disappointed', 'terrible', 'worst',
                'shikoyat', 'norozi', 'yomon',
                'жалоба', 'недоволен', 'плохо', 'ужасно'
            ],
            'category': MessageCategory.COMPLAINT,
            'can_auto_respond': False  # Needs human attention
        }
    }

    # Pre-defined responses
    RESPONSES = {
        'uz': {
            'greeting': "Salom! Men AI yordamchiman. Sizga qanday yordam bera olaman?",
            'schedule': "Jadvalingizni ko'rish uchun Dashboard > Dars jadvali bo'limiga o'ting.",
            'balance': "Balansingizni tekshirish uchun Profile > To'lovlar bo'limiga o'ting.",
            'grades': "Baholaringizni ko'rish uchun Academics > Baholarim bo'limiga o'ting.",
            'payment_how': "To'lov qilish uchun: Profile > To'lovlar > To'lov qilish tugmasini bosing.",
            'technical': "Texnik muammo haqida xabar bergani uchun rahmat. Tez orada mutaxassis aloqaga chiqadi.",
            'complaint': "Noqulaylık uchun uzr so'raymiz. Sizning murojatingiz yuqori ustuvorlikka ega. Tez orada javob beramiz.",
            'unknown': "Kechirasiz, savolingizni to'liq tushunmadim. Iltimos, batafsil yozing yoki qo'llab-quvvatlash bilan bog'laning."
        },
        'en': {
            'greeting': "Hello! I'm your AI assistant. How can I help you today?",
            'schedule': "To view your schedule, go to Dashboard > Class Schedule.",
            'balance': "To check your balance, go to Profile > Payments.",
            'grades': "To view your grades, go to Academics > My Grades.",
            'payment_how': "To make a payment: Profile > Payments > Make Payment button.",
            'technical': "Thank you for reporting the technical issue. A support specialist will contact you shortly.",
            'complaint': "We apologize for the inconvenience. Your concern has high priority and will be addressed soon.",
            'unknown': "I'm sorry, I didn't fully understand your question. Please provide more details or contact support."
        },
        'ru': {
            'greeting': "Здравствуйте! Я ваш AI-помощник. Чем могу помочь?",
            'schedule': "Чтобы посмотреть расписание, перейдите в Dashboard > Расписание занятий.",
            'balance': "Чтобы проверить баланс, перейдите в Профиль > Платежи.",
            'grades': "Чтобы посмотреть оценки, перейдите в Академические данные > Мои оценки.",
            'payment_how': "Для оплаты: Профиль > Платежи > кнопка Оплатить.",
            'technical': "Спасибо за сообщение о технической проблеме. Специалист свяжется с вами в ближайшее время.",
            'complaint': "Приносим извинения за неудобства. Ваше обращение имеет высокий приоритет и будет рассмотрено в ближайшее время.",
            'unknown': "Извините, я не полностью понял ваш вопрос. Пожалуйста, предоставьте больше деталей или свяжитесь с поддержкой."
        }
    }

    def __init__(self):
        """Initialize AI responder."""
        self.response_cache = {}

    def analyze_message(
        self,
        message_text: str,
        sender_user: Any = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> MessageAnalysis:
        """
        Analyze incoming message to determine category and response strategy.

        Args:
            message_text: Message text
            sender_user: User who sent the message
            conversation_history: Previous messages in conversation

        Returns:
            MessageAnalysis with category and decision
        """
        # Detect language
        from ai.language_detector import detect_language
        language = detect_language(message_text)

        # Categorize message
        category, confidence = self._categorize_message(message_text)

        # Extract entities (if needed)
        entities = {}
        intent = None

        # Determine if auto-response is appropriate
        should_auto_respond = self._should_auto_respond(
            category,
            confidence,
            conversation_history
        )

        # Assess urgency
        urgency = self._assess_urgency(message_text, category)

        return MessageAnalysis(
            category=category,
            confidence=confidence,
            language=language,
            intent=intent,
            entities=entities,
            should_auto_respond=should_auto_respond,
            urgency=urgency
        )

    def generate_response(
        self,
        message_text: str,
        sender_user: Any = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> Optional[AutoResponse]:
        """
        Generate auto-response for message.

        Args:
            message_text: Message text
            sender_user: User who sent the message
            conversation_history: Previous messages

        Returns:
            AutoResponse or None if can't auto-respond
        """
        # Analyze message
        analysis = self.analyze_message(message_text, sender_user, conversation_history)

        # Check if we should auto-respond
        if not analysis.should_auto_respond:
            logger.info(f"Message requires human response: {analysis.category}")
            return None

        # Generate response based on category
        response_text = self._generate_response_text(
            analysis.category,
            analysis.language,
            sender_user
        )

        # Generate follow-up suggestions
        suggestions = self._generate_suggestions(analysis.category, analysis.language)

        return AutoResponse(
            text=response_text,
            category=analysis.category,
            confidence=analysis.confidence,
            follow_up_suggestions=suggestions
        )

    def _categorize_message(self, text: str) -> Tuple[MessageCategory, float]:
        """
        Categorize message using pattern matching.

        Returns:
            Tuple of (category, confidence)
        """
        text_lower = text.lower()

        # Check FAQ patterns
        for faq_key, config in self.FAQ_PATTERNS.items():
            for pattern in config['patterns']:
                if pattern in text_lower:
                    return config['category'], 0.9

        # Check for greeting
        greeting_words = ['hello', 'hi', 'salom', 'assalomu alaykum', 'здравствуй', 'привет']
        if any(word in text_lower for word in greeting_words):
            return MessageCategory.GREETING, 0.95

        # Default to general question
        if '?' in text or 'how' in text_lower or 'what' in text_lower:
            return MessageCategory.QUESTION, 0.6

        return MessageCategory.GENERAL, 0.5

    def _should_auto_respond(
        self,
        category: MessageCategory,
        confidence: float,
        conversation_history: Optional[List[Dict]]
    ) -> bool:
        """
        Determine if message should be auto-responded.

        Args:
            category: Message category
            confidence: Categorization confidence
            conversation_history: Previous messages

        Returns:
            True if should auto-respond
        """
        # Never auto-respond to complaints or technical issues
        if category in [MessageCategory.COMPLAINT, MessageCategory.TECHNICAL_ISSUE]:
            return False

        # Don't auto-respond if confidence is too low
        if confidence < 0.7:
            return False

        # Check if this is a follow-up question
        if conversation_history and len(conversation_history) > 3:
            # If conversation is getting complex, escalate to human
            return False

        # Auto-respond to simple queries
        if category in [
            MessageCategory.GREETING,
            MessageCategory.SCHEDULE_QUERY,
            MessageCategory.PAYMENT_QUERY,
            MessageCategory.GRADE_QUERY,
            MessageCategory.INFO_REQUEST
        ]:
            return True

        return False

    def _assess_urgency(self, text: str, category: MessageCategory) -> str:
        """Assess message urgency."""
        text_lower = text.lower()

        # High urgency keywords
        urgent_keywords = [
            'urgent', 'asap', 'immediately', 'emergency',
            'shoshilinch', 'tezkor', 'zudlik bilan',
            'срочно', 'немедленно', 'срочный'
        ]

        if any(keyword in text_lower for keyword in urgent_keywords):
            return 'high'

        # Complaints and technical issues are medium-high urgency
        if category in [MessageCategory.COMPLAINT, MessageCategory.TECHNICAL_ISSUE]:
            return 'high'

        # Payment queries are medium urgency
        if category == MessageCategory.PAYMENT_QUERY:
            return 'medium'

        return 'low'

    def _generate_response_text(
        self,
        category: MessageCategory,
        language: str,
        user: Any = None
    ) -> str:
        """
        Generate response text based on category.

        Args:
            category: Message category
            language: Language code
            user: User object (for personalization)

        Returns:
            Response text
        """
        responses = self.RESPONSES.get(language, self.RESPONSES['en'])

        # Map category to response key
        category_map = {
            MessageCategory.GREETING: 'greeting',
            MessageCategory.SCHEDULE_QUERY: 'schedule',
            MessageCategory.PAYMENT_QUERY: 'balance',
            MessageCategory.GRADE_QUERY: 'grades',
            MessageCategory.INFO_REQUEST: 'unknown',
            MessageCategory.TECHNICAL_ISSUE: 'technical',
            MessageCategory.COMPLAINT: 'complaint',
        }

        response_key = category_map.get(category, 'unknown')
        response = responses.get(response_key, responses['unknown'])

        # Personalize if user is available
        if user and hasattr(user, 'first_name') and user.first_name:
            greeting_map = {
                'uz': f"Salom {user.first_name}! ",
                'en': f"Hello {user.first_name}! ",
                'ru': f"Здравствуйте {user.first_name}! "
            }
            greeting = greeting_map.get(language, '')
            if category == MessageCategory.GREETING:
                response = greeting + response

        return response

    def _generate_suggestions(
        self,
        category: MessageCategory,
        language: str
    ) -> List[str]:
        """Generate follow-up suggestions."""
        suggestions_map = {
            'uz': {
                MessageCategory.GREETING: [
                    "Dars jadvalini ko'rish",
                    "Balansni tekshirish",
                    "Baholarni ko'rish"
                ],
                MessageCategory.SCHEDULE_QUERY: [
                    "Bugungi darslar",
                    "Keyingi hafta",
                    "Kalendarga export"
                ],
                MessageCategory.PAYMENT_QUERY: [
                    "To'lov tarixi",
                    "To'lov qilish",
                    "Invoice yuklash"
                ],
                MessageCategory.GRADE_QUERY: [
                    "Barcha baholar",
                    "Oxirgi imtihonlar",
                    "Hisobot yuklash"
                ]
            },
            'en': {
                MessageCategory.GREETING: [
                    "View schedule",
                    "Check balance",
                    "View grades"
                ],
                MessageCategory.SCHEDULE_QUERY: [
                    "Today's classes",
                    "Next week",
                    "Export to calendar"
                ],
                MessageCategory.PAYMENT_QUERY: [
                    "Payment history",
                    "Make payment",
                    "Download invoice"
                ],
                MessageCategory.GRADE_QUERY: [
                    "All grades",
                    "Recent exams",
                    "Download report"
                ]
            },
            'ru': {
                MessageCategory.GREETING: [
                    "Посмотреть расписание",
                    "Проверить баланс",
                    "Посмотреть оценки"
                ],
                MessageCategory.SCHEDULE_QUERY: [
                    "Сегодняшние занятия",
                    "Следующая неделя",
                    "Экспорт в календарь"
                ],
                MessageCategory.PAYMENT_QUERY: [
                    "История платежей",
                    "Оплатить",
                    "Скачать счет"
                ],
                MessageCategory.GRADE_QUERY: [
                    "Все оценки",
                    "Последние экзамены",
                    "Скачать отчет"
                ]
            }
        }

        lang_suggestions = suggestions_map.get(language, suggestions_map['en'])
        return lang_suggestions.get(category, [])


# Global instance
_ai_responder = None


def get_ai_responder() -> AIMessageResponder:
    """Get or create global AI responder instance."""
    global _ai_responder
    if _ai_responder is None:
        _ai_responder = AIMessageResponder()
    return _ai_responder


def should_auto_respond(message_text: str, sender_user: Any = None) -> bool:
    """
    Check if message should be auto-responded.

    Args:
        message_text: Message text
        sender_user: User who sent the message

    Returns:
        True if should auto-respond
    """
    responder = get_ai_responder()
    analysis = responder.analyze_message(message_text, sender_user)
    return analysis.should_auto_respond


def generate_auto_response(
    message_text: str,
    sender_user: Any = None,
    conversation_history: Optional[List[Dict]] = None
) -> Optional[str]:
    """
    Generate auto-response for message.

    Args:
        message_text: Message text
        sender_user: User who sent the message
        conversation_history: Previous messages

    Returns:
        Response text or None
    """
    responder = get_ai_responder()
    response = responder.generate_response(message_text, sender_user, conversation_history)
    return response.text if response else None

"""
Enhanced NLU System with Advanced Intent Detection
===================================================
Enterprise-grade Natural Language Understanding with:
- Multi-strategy intent detection (rule-based + ML + semantic)
- Entity extraction with type validation
- Context management for multi-turn conversations
- Confidence scoring and fallback mechanisms
- Support for 50+ intents across all educational domains
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from django.core.cache import cache
from .intent_config import (
    INTENT_DEFINITIONS,
    IntentConfig,
    IntentCategory,
    get_intent_config,
    get_all_keywords,
)

log = logging.getLogger(__name__)

# =============================================================================
# ENHANCED ENTITY EXTRACTION
# =============================================================================

class EntityExtractor:
    """Advanced entity extraction with type validation"""

    # Entity patterns
    PATTERNS = {
        'phone': [
            r'\+998\d{9}',  # +998901234567
            r'998\d{9}',     # 998901234567
            r'\b\d{9}\b',    # 901234567
            r'\b\d{2}-\d{3}-\d{2}-\d{2}\b',  # 90-123-45-67
        ],
        'email': [
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        ],
        'amount': [
            r'(\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})?)\s*(?:so\'?m|som|uzs|usd|\$)',
            r'(\d+(?:\.\d{2})?)\s*(?:so\'?m|som|uzs|usd|\$)',
        ],
        'date': [
            r'\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b',  # 01.12.2024 or 01/12/24
            r'\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b',    # 2024-12-01
        ],
        'time': [
            r'\b(\d{1,2}):(\d{2})\s*(?:AM|PM|am|pm)?\b',   # 14:30 or 2:30 PM
            r'\bsoat\s+(\d{1,2})\b',  # soat 14
        ],
        'course_name': [
            r'\b(?:Python|JavaScript|Java|C\+\+|ingliz|matematika|fizika|rus)\b',
        ],
        'name': [
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b',  # Proper names
        ],
        'number': [
            r'\b(\d+)\b',
        ],
    }

    # Educational domain keywords
    COURSE_KEYWORDS = [
        'python', 'javascript', 'java', 'c++', 'c#', 'react', 'node',
        'ingliz', 'rus', 'matematika', 'fizika', 'kimyo', 'biologiya',
        'english', 'math', 'physics', 'chemistry', 'biology',
        'dasturlash', 'programming', 'web development', 'mobile',
    ]

    def extract_entities(self, text: str) -> Dict[str, Any]:
        """
        Extract all entities from text with validation

        Returns:
            Dict with entity types as keys and extracted values
        """
        entities = {}
        text_lower = text.lower()

        # Phone number
        for pattern in self.PATTERNS['phone']:
            match = re.search(pattern, text)
            if match:
                entities['phone'] = self._normalize_phone(match.group(0))
                break

        # Email
        for pattern in self.PATTERNS['email']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                entities['email'] = match.group(0).lower()
                break

        # Amount/Money
        for pattern in self.PATTERNS['amount']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1) if len(match.groups()) > 0 else match.group(0)
                entities['amount'] = self._parse_amount(amount_str)
                break

        # Date
        date_entity = self._extract_date(text)
        if date_entity:
            entities['date'] = date_entity

        # Time
        for pattern in self.PATTERNS['time']:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                entities['time'] = match.group(0)
                break

        # Course name
        for course_kw in self.COURSE_KEYWORDS:
            if course_kw in text_lower:
                entities['course_name'] = course_kw.title()
                break

        # Person name (basic extraction)
        for pattern in self.PATTERNS['name']:
            match = re.search(pattern, text)
            if match:
                entities['name'] = match.group(0)
                break

        # Quiz/Assignment ID (if numeric ID mentioned)
        id_match = re.search(r'(?:quiz|test|assignment|vazifa|topshiriq)\s+#?(\d+)', text_lower)
        if id_match:
            entities['quiz_id'] = id_match.group(1)
            entities['assignment_id'] = id_match.group(1)

        return entities

    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to +998XXXXXXXXX format"""
        digits = re.sub(r'\D', '', phone)
        if len(digits) == 9:
            return f'+998{digits}'
        elif len(digits) == 12 and digits.startswith('998'):
            return f'+{digits}'
        elif len(digits) == 13 and digits.startswith('+998'):
            return digits
        return phone

    def _parse_amount(self, amount_str: str) -> float:
        """Parse amount string to float"""
        # Remove spaces, commas
        clean = re.sub(r'[,\s]', '', amount_str)
        try:
            return float(clean)
        except ValueError:
            return 0.0

    def _extract_date(self, text: str) -> Optional[str]:
        """Extract and normalize date to ISO format"""
        # Relative dates
        text_lower = text.lower()
        today = datetime.now()

        if any(w in text_lower for w in ['bugun', 'today']):
            return today.strftime('%Y-%m-%d')
        if any(w in text_lower for w in ['ertaga', 'tomorrow']):
            return (today + timedelta(days=1)).strftime('%Y-%m-%d')
        if any(w in text_lower for w in ['kecha', 'yesterday']):
            return (today - timedelta(days=1)).strftime('%Y-%m-%d')

        # Absolute dates
        for pattern in self.PATTERNS['date']:
            match = re.search(pattern, text)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) == 3:
                        # Try different date formats
                        if len(groups[0]) == 4:  # YYYY-MM-DD
                            year, month, day = groups
                        else:  # DD-MM-YYYY
                            day, month, year = groups

                        if len(year) == 2:
                            year = f'20{year}'

                        date_obj = datetime(int(year), int(month), int(day))
                        return date_obj.strftime('%Y-%m-%d')
                except (ValueError, IndexError):
                    continue

        return None


# =============================================================================
# ENHANCED INTENT DETECTION
# =============================================================================

class EnhancedIntentDetector:
    """
    Multi-strategy intent detection with:
    - Rule-based keyword matching (fast, exact)
    - ML-based classification (sklearn pipeline)
    - Semantic similarity (future: sentence transformers)
    - Context-aware disambiguation
    """

    def __init__(self):
        self.entity_extractor = EntityExtractor()
        self._ml_pipeline = None

    def detect_intent(
        self,
        text: str,
        context: Optional[Dict] = None,
        user: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Detect intent using multi-strategy approach

        Args:
            text: User input text
            context: Conversation context (previous intents, entities)
            user: User object for permission checking

        Returns:
            {
                'intent': str,
                'confidence': float,
                'method': str,
                'entities': dict,
                'alternatives': List[Tuple[str, float]]
            }
        """
        if not text or not text.strip():
            return self._unknown_intent()

        text = text.strip()

        # 1. Extract entities first (they help with intent detection)
        entities = self.entity_extractor.extract_entities(text)

        # 2. Try rule-based detection (fast path)
        rule_result = self._rule_based_detection(text, entities)

        # 3. Try ML-based detection if rule confidence is low
        if rule_result['confidence'] < 0.7:
            ml_result = self._ml_based_detection(text)

            # Choose better result
            if ml_result['confidence'] > rule_result['confidence']:
                result = ml_result
            else:
                result = rule_result
        else:
            result = rule_result

        # 4. Context-based disambiguation (if multiple candidates)
        if context and 'alternatives' in result and len(result['alternatives']) > 1:
            result = self._disambiguate_with_context(result, context)

        # 5. Validate intent configuration
        intent_config = get_intent_config(result['intent'])
        if intent_config:
            # Check if user meets requirements
            if intent_config.requires_auth and not user:
                result['requires_login'] = True

            # Check if required entities are present
            missing_entities = []
            for req_entity in intent_config.requires_entities:
                if req_entity not in entities:
                    missing_entities.append(req_entity)

            if missing_entities:
                result['missing_entities'] = missing_entities
                result['status'] = 'incomplete'

        result['entities'] = entities
        return result

    def _rule_based_detection(
        self,
        text: str,
        entities: Dict
    ) -> Dict[str, Any]:
        """
        Keyword-based intent detection with scoring
        """
        text_lower = text.lower()
        scores = {}

        # Score each intent based on keyword matches
        for intent_name, config in INTENT_DEFINITIONS.items():
            score = 0
            matched_keywords = []

            # Primary keywords
            for keyword in config.keywords:
                if keyword.lower() in text_lower:
                    score += 2  # Primary keyword match = 2 points
                    matched_keywords.append(keyword)

            # Aliases
            for alias in config.aliases:
                if alias.lower() in text_lower:
                    score += 1  # Alias match = 1 point

            # Bonus for entity presence
            for req_entity in config.requires_entities:
                if req_entity in entities:
                    score += 0.5  # Entity match = 0.5 points

            if score > 0:
                scores[intent_name] = {
                    'score': score,
                    'matched_keywords': matched_keywords
                }

        if not scores:
            return self._unknown_intent()

        # Get top intent and alternatives
        sorted_intents = sorted(
            scores.items(),
            key=lambda x: x[1]['score'],
            reverse=True
        )

        best_intent, best_score_data = sorted_intents[0]
        best_score = best_score_data['score']

        # Calculate confidence (normalize to 0-1)
        max_possible_score = len(INTENT_DEFINITIONS[best_intent].keywords) * 2
        confidence = min(best_score / max(max_possible_score, 1), 1.0)

        # Get alternatives
        alternatives = [
            (intent, data['score'] / max(max_possible_score, 1))
            for intent, data in sorted_intents[1:4]  # Top 3 alternatives
        ]

        return {
            'intent': best_intent,
            'confidence': float(confidence),
            'method': 'rule',
            'matched_keywords': best_score_data['matched_keywords'],
            'alternatives': alternatives,
        }

    def _ml_based_detection(self, text: str) -> Dict[str, Any]:
        """
        ML-based intent classification using sklearn pipeline
        """
        try:
            from . import services
            pipeline = services.load_intent_pipeline()

            pred = pipeline.predict([text])[0]
            probs = pipeline.predict_proba([text])[0]

            # Get top predictions
            classes = list(pipeline.classes_)
            top_indices = probs.argsort()[-4:][::-1]  # Top 4

            alternatives = [
                (classes[idx], float(probs[idx]))
                for idx in top_indices[1:]
            ]

            best_idx = top_indices[0]

            return {
                'intent': str(classes[best_idx]),
                'confidence': float(probs[best_idx]),
                'method': 'ml',
                'alternatives': alternatives,
            }
        except Exception as e:
            log.warning(f"ML intent detection failed: {e}")
            return self._unknown_intent()

    def _disambiguate_with_context(
        self,
        result: Dict,
        context: Dict
    ) -> Dict:
        """
        Use conversation context to disambiguate between similar intents
        """
        if not context.get('previous_intent'):
            return result

        # Context-based rules
        prev_intent = context['previous_intent']
        alternatives = result.get('alternatives', [])

        # If previous intent was about courses and alternatives include course-related intents
        if prev_intent.startswith('course_'):
            for alt_intent, alt_conf in alternatives:
                if alt_intent.startswith('course_') and alt_conf > result['confidence'] - 0.1:
                    result['intent'] = alt_intent
                    result['confidence'] = alt_conf
                    result['method'] += '+context'
                    break

        return result

    def _unknown_intent(self) -> Dict[str, Any]:
        """Return unknown intent result"""
        return {
            'intent': 'unknown',
            'confidence': 0.0,
            'method': 'none',
            'alternatives': [],
        }


# =============================================================================
# CONVERSATION CONTEXT MANAGER
# =============================================================================

class ConversationContext:
    """
    Manage conversation context for multi-turn dialogues
    Uses Django cache for session storage
    """

    CACHE_PREFIX = 'conv_context:'
    CACHE_TIMEOUT = 3600  # 1 hour

    @classmethod
    def get_context(cls, user_id: str) -> Dict[str, Any]:
        """Get conversation context for user"""
        cache_key = f'{cls.CACHE_PREFIX}{user_id}'
        context = cache.get(cache_key)

        if not context:
            context = {
                'user_id': user_id,
                'previous_intent': None,
                'previous_entities': {},
                'conversation_history': [],
                'incomplete_intent': None,
                'missing_entities': [],
                'created_at': datetime.now().isoformat(),
            }
            cls.save_context(user_id, context)

        return context

    @classmethod
    def save_context(cls, user_id: str, context: Dict) -> None:
        """Save conversation context"""
        cache_key = f'{cls.CACHE_PREFIX}{user_id}'
        context['updated_at'] = datetime.now().isoformat()
        cache.set(cache_key, context, cls.CACHE_TIMEOUT)

    @classmethod
    def update_context(
        cls,
        user_id: str,
        intent: str,
        entities: Dict,
        status: str = 'complete'
    ) -> None:
        """Update context after intent processing"""
        context = cls.get_context(user_id)

        # Add to history (keep last 10)
        context['conversation_history'].append({
            'intent': intent,
            'entities': entities,
            'timestamp': datetime.now().isoformat(),
            'status': status,
        })
        if len(context['conversation_history']) > 10:
            context['conversation_history'] = context['conversation_history'][-10:]

        # Update current state
        context['previous_intent'] = intent
        context['previous_entities'] = entities

        if status == 'incomplete':
            context['incomplete_intent'] = intent
        else:
            context['incomplete_intent'] = None
            context['missing_entities'] = []

        cls.save_context(user_id, context)

    @classmethod
    def clear_context(cls, user_id: str) -> None:
        """Clear conversation context"""
        cache_key = f'{cls.CACHE_PREFIX}{user_id}'
        cache.delete(cache_key)


# =============================================================================
# HIGH-LEVEL NLU PROCESSOR
# =============================================================================

class NLUProcessor:
    """
    High-level NLU processor combining all components
    """

    def __init__(self):
        self.intent_detector = EnhancedIntentDetector()

    def process(
        self,
        text: str,
        user: Optional[Any] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process user input through complete NLU pipeline

        Returns:
            {
                'status': 'ok'|'incomplete'|'error',
                'intent': str,
                'confidence': float,
                'entities': dict,
                'method': str,
                'requires_login': bool,
                'missing_entities': List[str],
                'prompt': Optional[str],  # Prompt for missing entities
            }
        """
        # Get conversation context
        context = None
        if user_id:
            context = ConversationContext.get_context(user_id)

        # Detect intent
        result = self.intent_detector.detect_intent(text, context, user)

        # Build response
        response = {
            'status': 'ok',
            'intent': result['intent'],
            'confidence': result['confidence'],
            'entities': result.get('entities', {}),
            'method': result['method'],
            'alternatives': result.get('alternatives', []),
        }

        # Check for authentication requirement
        if result.get('requires_login'):
            response['status'] = 'error'
            response['error'] = 'authentication_required'
            response['message'] = 'Iltimos, tizimga kiring. / Please log in.'
            return response

        # Check for missing entities
        if result.get('missing_entities'):
            response['status'] = 'incomplete'
            response['missing_entities'] = result['missing_entities']
            response['prompt'] = self._generate_entity_prompt(
                result['intent'],
                result['missing_entities']
            )

            # Save incomplete state to context
            if user_id:
                ConversationContext.update_context(
                    user_id,
                    result['intent'],
                    result.get('entities', {}),
                    status='incomplete'
                )

            return response

        # Check confidence threshold
        intent_config = get_intent_config(result['intent'])
        min_confidence = intent_config.min_confidence if intent_config else 0.4

        if result['confidence'] < min_confidence:
            response['status'] = 'clarify'
            response['message'] = 'Nimani nazarda tutyapsiz? Iltimos, aniqroq ayting.'
            response['suggestions'] = [
                alt[0] for alt in result.get('alternatives', [])[:3]
            ]
            return response

        # Update context on success
        if user_id:
            ConversationContext.update_context(
                user_id,
                result['intent'],
                result.get('entities', {}),
                status='complete'
            )

        return response

    def _generate_entity_prompt(
        self,
        intent: str,
        missing_entities: List[str]
    ) -> str:
        """Generate prompt for missing entities"""
        entity_prompts = {
            'course_name': 'Qaysi kurs haqida? / Which course?',
            'phone': 'Telefon raqamingiz? / Phone number?',
            'email': 'Email manzilingiz? / Email address?',
            'amount': 'Qancha summa? / What amount?',
            'date': 'Qaysi sana? / Which date?',
            'time': 'Qaysi vaqt? / What time?',
            'name': 'Ism familiya? / Full name?',
            'assignment_id': 'Qaysi topshiriq? / Which assignment?',
            'quiz_id': 'Qaysi test? / Which quiz?',
            'message': 'Xabar matni? / Message text?',
            'recipient': 'Kimga? / To whom?',
        }

        prompts = [
            entity_prompts.get(entity, f'{entity}?')
            for entity in missing_entities
        ]

        return 'Iltimos, quyidagilarni kiriting: ' + ', '.join(prompts)


# =============================================================================
# MAIN EXPORT
# =============================================================================

# Global NLU processor instance
_nlu_processor = None

def get_nlu_processor() -> NLUProcessor:
    """Get or create NLU processor instance"""
    global _nlu_processor
    if _nlu_processor is None:
        _nlu_processor = NLUProcessor()
    return _nlu_processor

def process_nlu(
    text: str,
    user: Optional[Any] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for NLU processing

    Args:
        text: User input text
        user: Django User object
        user_id: User ID for context management

    Returns:
        NLU result dictionary
    """
    processor = get_nlu_processor()
    return processor.process(text, user, user_id)

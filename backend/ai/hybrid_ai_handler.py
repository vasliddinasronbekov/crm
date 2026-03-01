"""
Hybrid AI Handler that intelligently combines intent-based and LLM-based responses.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from .llm_service import (
    LLMService, LLMMessage, ConversationManager, LLMQuality
)
from .enhanced_nlu import process_nlu
from .intent_fulfillment import fulfill_intent

logger = logging.getLogger(__name__)


class HybridAIHandler:
    """
    Intelligent AI handler that chooses between intent-based and LLM-based responses.

    Decision Flow:
    1. Detect intent using existing hybrid system (rule + ML)
    2. If high confidence intent -> use intent handler
    3. If low confidence OR conversational query -> use LLM
    4. LLM can also invoke intents if needed
    """

    def __init__(self, llm_quality: str = 'balanced'):
        """
        Initialize hybrid handler.

        Args:
            llm_quality: LLM quality level ('fast', 'balanced', 'high', 'premium')
        """
        self.llm = None
        try:
            quality_map = {
                'fast': LLMQuality.FAST,
                'balanced': LLMQuality.BALANCED,
                'high': LLMQuality.HIGH,
                'premium': LLMQuality.PREMIUM,
            }
            self.llm = LLMService(quality=quality_map.get(llm_quality, LLMQuality.BALANCED))
            logger.info(f"LLM service initialized with quality: {llm_quality}")
        except Exception as e:
            logger.warning(f"LLM service not available: {e}. Will use intent-only mode.")
            self.llm = None

        self.intent_confidence_threshold = 0.65
        self.conversation_managers: Dict[str, ConversationManager] = {}

    def process(
        self,
        text: str,
        user: Any,
        conversation_id: Optional[str] = None,
        user_context: Optional[Dict] = None,
        force_mode: Optional[str] = None  # 'intent', 'llm', or None (auto)
    ) -> Dict[str, Any]:
        """
        Process user message with hybrid intelligence.

        Args:
            text: User message text
            user: User object
            conversation_id: Conversation ID for context
            user_context: Additional user context
            force_mode: Force specific mode ('intent', 'llm', None for auto)

        Returns:
            Dict with response, metadata, and processing info
        """
        start_time = datetime.now()

        # Step 1: Intent Detection (always run for metadata)
        nlu_result = process_nlu(text, user=user, user_id=str(user.id) if user else None)
        intent = nlu_result.get('intent')
        confidence = nlu_result.get('confidence', 0)

        # Extract entities from NLU result
        entities = nlu_result.get('entities', {})

        # Build context (with automatic language detection)
        if not user_context:
            user_context = self._build_user_context(user, text)
        elif 'language' not in user_context and text:
            # Auto-detect language if not provided
            from .language_detector import detect_language_smart
            user_context['language'] = detect_language_smart(
                text,
                user_id=user.id if user else None
            )

        # Step 2: Decide processing mode
        mode = self._decide_mode(
            text=text,
            intent=intent,
            confidence=confidence,
            force_mode=force_mode
        )

        # Step 3: Process based on mode
        if mode == 'intent':
            result = self._process_intent(
                text=text,
                nlu_result=nlu_result,
                entities=entities,
                user=user
            )
        elif mode == 'llm' and self.llm:
            result = self._process_llm(
                text=text,
                conversation_id=conversation_id,
                user_context=user_context,
                detected_intent=intent,
                intent_confidence=confidence
            )
        else:
            # Fallback to intent if LLM unavailable
            result = self._process_intent(
                text=text,
                nlu_result=nlu_result,
                entities=entities,
                user=user
            )

        # Step 4: Add metadata
        processing_time = (datetime.now() - start_time).total_seconds()
        result['metadata'] = {
            **result.get('metadata', {}),
            'processing_mode': mode,
            'detected_intent': intent,
            'intent_confidence': confidence,
            'processing_time_seconds': processing_time,
            'timestamp': datetime.now().isoformat()
        }

        return result

    def _decide_mode(
        self,
        text: str,
        intent: str,
        confidence: float,
        force_mode: Optional[str]
    ) -> str:
        """Decide whether to use intent-based or LLM-based processing."""

        # Force mode if specified
        if force_mode in ['intent', 'llm']:
            return force_mode

        # No LLM available -> intent only
        if not self.llm:
            return 'intent'

        # High confidence intent -> use intent handler
        if confidence >= self.intent_confidence_threshold:
            return 'intent'

        # Low confidence -> use LLM
        if confidence < 0.4:
            return 'llm'

        # Check for conversational patterns
        if self._is_conversational(text):
            return 'llm'

        # Medium confidence (0.4-0.65) -> prefer intent but LLM can supplement
        return 'intent'

    def _is_conversational(self, text: str) -> bool:
        """Detect if message is conversational/open-ended."""
        conversational_patterns = [
            # English
            'why', 'how', 'explain', 'tell me about', 'what do you think',
            'can you help', 'i want to know', 'what is', 'what are',

            # Uzbek
            'nega', 'qanday', 'tushuntir', 'aytib ber', 'bilmoqchiman',
            'yordam bering', 'nima', 'nimalar',

            # Russian
            'почему', 'как', 'объясни', 'расскажи', 'что такое',
            'помоги', 'хочу узнать', 'что это',
        ]

        text_lower = text.lower()
        return any(pattern in text_lower for pattern in conversational_patterns)

    def _process_intent(
        self,
        text: str,
        nlu_result: Dict,
        entities: Dict,
        user: Any
    ) -> Dict[str, Any]:
        """Process using intent-based system."""
        try:
            intent = nlu_result.get('intent')

            # Use fulfill_intent to handle the intent
            result = fulfill_intent(
                intent=intent,
                entities=entities,
                user=user,
                text=text
            )

            return {
                'status': result.get('status', 'ok'),
                'response': result.get('response', 'Intent processed'),
                'intent': intent,
                'confidence': nlu_result.get('confidence'),
                'entities': entities,
                'data': result.get('data'),
                'metadata': {
                    'processing_type': 'intent',
                    'method': nlu_result.get('method'),
                }
            }
        except Exception as e:
            logger.error(f"Intent processing failed: {e}")
            return {
                'status': 'error',
                'response': 'Kechirasiz, xatolik yuz berdi. / Sorry, an error occurred.',
                'error': str(e),
                'metadata': {'processing_type': 'intent', 'error': True}
            }

    def _process_llm(
        self,
        text: str,
        conversation_id: Optional[str],
        user_context: Dict,
        detected_intent: Optional[str],
        intent_confidence: float
    ) -> Dict[str, Any]:
        """Process using LLM with conversation context."""
        try:
            # Get or create conversation manager
            conv_mgr = None
            if conversation_id:
                if conversation_id not in self.conversation_managers:
                    self.conversation_managers[conversation_id] = ConversationManager(conversation_id)
                conv_mgr = self.conversation_managers[conversation_id]

                # Load conversation history
                messages = conv_mgr.get_llm_messages()
            else:
                messages = []

            # Add detected intent to context if available
            if detected_intent and intent_confidence > 0.3:
                user_context['detected_intent'] = detected_intent
                user_context['intent_confidence'] = intent_confidence

            # Add current message
            messages.append(LLMMessage(role='user', content=text))

            # Generate response
            response = self.llm.chat(
                messages=messages,
                user_context=user_context,
                system_prompt_type=user_context.get('user_role', 'general')
            )

            # Save to conversation history
            if conv_mgr:
                conv_mgr.add_message('user', text)
                conv_mgr.add_message('assistant', response.content, metadata={
                    'provider': response.provider,
                    'model': response.model,
                    'tokens': response.tokens_used,
                    'cost': response.cost_usd
                })

            return {
                'status': 'ok',
                'response': response.content,
                'detected_intent': detected_intent,
                'intent_confidence': intent_confidence,
                'metadata': {
                    'processing_type': 'llm',
                    'provider': response.provider,
                    'model': response.model,
                    'tokens_used': response.tokens_used,
                    'cost_usd': response.cost_usd,
                    'finish_reason': response.finish_reason,
                }
            }

        except Exception as e:
            logger.error(f"LLM processing failed: {e}")

            # Fallback to intent if we have one
            if detected_intent and intent_confidence > 0.4:
                logger.info(f"Falling back to intent: {detected_intent}")
                # Re-run NLU to get entities
                fallback_nlu = process_nlu(text, user=None, user_id=None)
                return self._process_intent(
                    text=text,
                    nlu_result={'intent': detected_intent, 'confidence': intent_confidence},
                    entities=fallback_nlu.get('entities', {}),
                    user=None
                )

            return {
                'status': 'error',
                'response': 'Kechirasiz, xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring. / Sorry, an error occurred. Please try again.',
                'error': str(e),
                'metadata': {'processing_type': 'llm', 'error': True, 'fallback_attempted': True}
            }

    def _build_user_context(self, user: Any, user_message: str = '') -> Dict[str, Any]:
        """Build user context from user object."""
        context = {
            'user_id': user.id if user else None,
            'user_role': 'general',
        }

        if user:
            # Determine user role
            if hasattr(user, 'role'):
                context['user_role'] = user.role
            elif hasattr(user, 'is_staff') and user.is_staff:
                context['user_role'] = 'staff'
            else:
                context['user_role'] = 'student'

            # Add language preference if available
            if hasattr(user, 'language'):
                context['language'] = user.language
            elif user_message:
                # Auto-detect language from message
                from .language_detector import detect_language_smart
                detected_lang = detect_language_smart(
                    user_message,
                    user_id=user.id if user else None
                )
                context['language'] = detected_lang
                logger.info(f"Auto-detected language for user {user.id}: {detected_lang}")

        return context

    def get_conversation_summary(self, conversation_id: str) -> Optional[str]:
        """Get summary of conversation."""
        if conversation_id in self.conversation_managers:
            return self.conversation_managers[conversation_id].get_context_summary()
        return None

    def clear_conversation(self, conversation_id: str):
        """Clear conversation history."""
        if conversation_id in self.conversation_managers:
            self.conversation_managers[conversation_id].clear()
            del self.conversation_managers[conversation_id]


# Global handler instance
_hybrid_handler = None


def get_hybrid_handler(llm_quality: str = 'balanced') -> HybridAIHandler:
    """Get or create global hybrid handler instance."""
    global _hybrid_handler
    if _hybrid_handler is None:
        _hybrid_handler = HybridAIHandler(llm_quality=llm_quality)
    return _hybrid_handler


def process_user_message(
    text: str,
    user: Any,
    conversation_id: Optional[str] = None,
    user_context: Optional[Dict] = None,
    force_mode: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenient function to process user message with hybrid AI.

    Args:
        text: User message
        user: User object
        conversation_id: Conversation ID
        user_context: Additional context
        force_mode: Force 'intent' or 'llm' mode

    Returns:
        Response dict with message and metadata
    """
    handler = get_hybrid_handler()
    return handler.process(
        text=text,
        user=user,
        conversation_id=conversation_id,
        user_context=user_context,
        force_mode=force_mode
    )

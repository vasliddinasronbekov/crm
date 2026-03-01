"""
Enterprise LLM Service with multi-provider support (OpenAI, Anthropic, Local models).
Provides intelligent conversation handling beyond intent-based responses.
"""
import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"  # For future local model integration


class LLMQuality(Enum):
    """LLM quality/cost tiers."""
    FAST = "fast"  # Faster, cheaper models (gpt-3.5-turbo, claude-instant)
    BALANCED = "balanced"  # Balanced quality/cost (gpt-4o-mini, claude-haiku)
    HIGH = "high"  # Best quality (gpt-4, claude-sonnet)
    PREMIUM = "premium"  # Ultra quality (gpt-4-turbo, claude-opus)


@dataclass
class LLMMessage:
    """Structured message for LLM conversation."""
    role: str  # 'system', 'user', 'assistant'
    content: str
    metadata: Optional[Dict] = None


@dataclass
class LLMResponse:
    """Structured response from LLM."""
    content: str
    provider: str
    model: str
    tokens_used: Dict[str, int]  # {'prompt': X, 'completion': Y, 'total': Z}
    cost_usd: float
    finish_reason: str  # 'stop', 'length', 'content_filter', etc.
    metadata: Dict[str, Any]


class LLMService:
    """
    Enterprise LLM Service with intelligent provider selection and fallback.
    """

    # Model configurations for different quality levels
    MODEL_CONFIGS = {
        LLMQuality.FAST: {
            LLMProvider.OPENAI: {"model": "gpt-3.5-turbo", "cost_per_1k_input": 0.0015, "cost_per_1k_output": 0.002},
            LLMProvider.ANTHROPIC: {"model": "claude-3-haiku-20240307", "cost_per_1k_input": 0.00025, "cost_per_1k_output": 0.00125},
        },
        LLMQuality.BALANCED: {
            LLMProvider.OPENAI: {"model": "gpt-4o-mini", "cost_per_1k_input": 0.00015, "cost_per_1k_output": 0.0006},
            LLMProvider.ANTHROPIC: {"model": "claude-3-haiku-20240307", "cost_per_1k_input": 0.00025, "cost_per_1k_output": 0.00125},
        },
        LLMQuality.HIGH: {
            LLMProvider.OPENAI: {"model": "gpt-4o", "cost_per_1k_input": 0.0025, "cost_per_1k_output": 0.01},
            LLMProvider.ANTHROPIC: {"model": "claude-3-5-sonnet-20241022", "cost_per_1k_input": 0.003, "cost_per_1k_output": 0.015},
        },
        LLMQuality.PREMIUM: {
            LLMProvider.OPENAI: {"model": "gpt-4-turbo", "cost_per_1k_input": 0.01, "cost_per_1k_output": 0.03},
            LLMProvider.ANTHROPIC: {"model": "claude-3-opus-20240229", "cost_per_1k_input": 0.015, "cost_per_1k_output": 0.075},
        },
    }

    # System prompts for different contexts
    SYSTEM_PROMPTS = {
        'student': """You are an AI assistant for an educational platform helping students.
You help with:
- Answering questions about courses, schedules, and assignments
- Providing study guidance and explanations
- Checking grades, attendance, and payments
- General educational support

Always be helpful, encouraging, and educational. Respond in the user's language (Uzbek, Russian, or English).
If asked to perform specific actions (check payment, view schedule), guide the user on how to do it.""",

        'staff': """You are an AI assistant for educational institution staff.
You help with:
- Managing students, groups, and courses
- Viewing analytics and reports
- Processing leads and CRM tasks
- Administrative tasks and queries

Be professional, efficient, and data-driven. Respond in the user's language (Uzbek, Russian, or English).
For specific actions, guide users on the available tools and commands.""",

        'general': """You are a helpful AI assistant for an educational platform.
Assist with questions, provide information, and guide users effectively.
Respond in the user's language (Uzbek, Russian, or English).""",
    }

    def __init__(
        self,
        provider: Optional[LLMProvider] = None,
        quality: LLMQuality = LLMQuality.BALANCED,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ):
        """
        Initialize LLM service.

        Args:
            provider: LLM provider to use (auto-detect if None)
            quality: Quality/cost tier
            temperature: Response creativity (0-1)
            max_tokens: Maximum response length
        """
        self.provider = provider or self._detect_provider()
        self.quality = quality
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Initialize clients
        self._openai_client = None
        self._anthropic_client = None
        self._init_clients()

    def _detect_provider(self) -> LLMProvider:
        """Auto-detect available LLM provider based on API keys."""
        # Prefer local LLM first (free, private)
        use_local = os.getenv('USE_LOCAL_LLM', 'true').lower() == 'true'

        if use_local:
            try:
                # Check if local LLM is available
                from .local_llm_service import LocalLLMService
                logger.info("Using Local LLM (free, multilingual)")
                return LLMProvider.LOCAL
            except Exception as e:
                logger.warning(f"Local LLM not available: {e}. Trying API providers...")

        # Fallback to API providers
        if os.getenv('OPENAI_API_KEY'):
            return LLMProvider.OPENAI
        elif os.getenv('ANTHROPIC_API_KEY'):
            return LLMProvider.ANTHROPIC
        else:
            logger.warning("No LLM providers available. LLM features will be disabled.")
            return LLMProvider.LOCAL

    def _init_clients(self):
        """Initialize LLM client libraries."""
        # Initialize Local LLM
        self._local_llm_client = None
        if self.provider == LLMProvider.LOCAL:
            try:
                from .local_llm_service import LocalLLMService
                model_name = os.getenv('LOCAL_LLM_MODEL', 'openchat-3.5-q4')
                self._local_llm_client = LocalLLMService(model_name=model_name)
                logger.info(f"Local LLM initialized: {model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Local LLM: {e}")

        # Initialize OpenAI
        try:
            if self.provider == LLMProvider.OPENAI or os.getenv('OPENAI_API_KEY'):
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                logger.info("OpenAI client initialized")
        except ImportError:
            logger.warning("openai library not installed. Install with: pip install openai")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")

        # Initialize Anthropic
        try:
            if self.provider == LLMProvider.ANTHROPIC or os.getenv('ANTHROPIC_API_KEY'):
                from anthropic import Anthropic
                self._anthropic_client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
                logger.info("Anthropic client initialized")
        except ImportError:
            logger.warning("anthropic library not installed. Install with: pip install anthropic")
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {e}")

    def chat(
        self,
        messages: List[LLMMessage],
        user_context: Optional[Dict] = None,
        system_prompt_type: str = 'general',
        stream: bool = False
    ) -> LLMResponse:
        """
        Generate a chat response using the configured LLM.

        Args:
            messages: List of conversation messages
            user_context: Additional context (user role, language, etc.)
            system_prompt_type: Type of system prompt ('student', 'staff', 'general')
            stream: Enable streaming response

        Returns:
            LLMResponse with generated content
        """
        # Add system prompt
        system_prompt = self._build_system_prompt(system_prompt_type, user_context)
        full_messages = [LLMMessage(role='system', content=system_prompt)] + messages

        # Try primary provider, fallback to alternatives
        providers_to_try = [self.provider]

        # Add fallback providers
        if self.provider == LLMProvider.LOCAL:
            if self._openai_client:
                providers_to_try.append(LLMProvider.OPENAI)
            if self._anthropic_client:
                providers_to_try.append(LLMProvider.ANTHROPIC)
        elif self.provider == LLMProvider.OPENAI:
            if self._anthropic_client:
                providers_to_try.append(LLMProvider.ANTHROPIC)
            if self._local_llm_client:
                providers_to_try.append(LLMProvider.LOCAL)
        elif self.provider == LLMProvider.ANTHROPIC:
            if self._openai_client:
                providers_to_try.append(LLMProvider.OPENAI)
            if self._local_llm_client:
                providers_to_try.append(LLMProvider.LOCAL)

        last_error = None
        for provider in providers_to_try:
            try:
                if provider == LLMProvider.LOCAL:
                    return self._chat_local(full_messages, stream, user_context)
                elif provider == LLMProvider.OPENAI:
                    return self._chat_openai(full_messages, stream)
                elif provider == LLMProvider.ANTHROPIC:
                    return self._chat_anthropic(full_messages, stream)
            except Exception as e:
                logger.error(f"LLM call failed with {provider.value}: {e}")
                last_error = e
                continue

        # All providers failed
        raise Exception(f"All LLM providers failed. Last error: {last_error}")

    def _build_system_prompt(self, prompt_type: str, user_context: Optional[Dict]) -> str:
        """Build system prompt with context."""
        base_prompt = self.SYSTEM_PROMPTS.get(prompt_type, self.SYSTEM_PROMPTS['general'])

        if user_context:
            context_info = []
            if user_context.get('user_role'):
                context_info.append(f"User role: {user_context['user_role']}")
            if user_context.get('language'):
                context_info.append(f"Preferred language: {user_context['language']}")
            if user_context.get('current_page'):
                context_info.append(f"Current page: {user_context['current_page']}")

            if context_info:
                base_prompt += "\n\nContext:\n" + "\n".join(context_info)

        return base_prompt

    def _chat_openai(self, messages: List[LLMMessage], stream: bool) -> LLMResponse:
        """Generate response using OpenAI."""
        if not self._openai_client:
            raise Exception("OpenAI client not initialized")

        model_config = self.MODEL_CONFIGS[self.quality][LLMProvider.OPENAI]
        model = model_config['model']

        # Convert messages to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        response = self._openai_client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=stream
        )

        if stream:
            # TODO: Implement streaming support
            raise NotImplementedError("Streaming not yet implemented")

        # Calculate cost
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens

        cost_usd = (
            (prompt_tokens / 1000) * model_config['cost_per_1k_input'] +
            (completion_tokens / 1000) * model_config['cost_per_1k_output']
        )

        return LLMResponse(
            content=response.choices[0].message.content,
            provider=LLMProvider.OPENAI.value,
            model=model,
            tokens_used={
                'prompt': prompt_tokens,
                'completion': completion_tokens,
                'total': total_tokens
            },
            cost_usd=cost_usd,
            finish_reason=response.choices[0].finish_reason,
            metadata={
                'temperature': self.temperature,
                'max_tokens': self.max_tokens
            }
        )

    def _chat_local(self, messages: List[LLMMessage], stream: bool, user_context: Optional[Dict]) -> LLMResponse:
        """Generate response using Local LLM."""
        if not self._local_llm_client:
            raise Exception("Local LLM client not initialized")

        # Convert messages to local LLM format
        local_messages = []
        for msg in messages:
            if msg.role != 'system':  # System handled separately
                local_messages.append({
                    'role': msg.role,
                    'content': msg.content
                })

        # Get language from context
        language = user_context.get('language', 'en') if user_context else 'en'
        user_role = user_context.get('user_role', 'general') if user_context else 'general'

        # Generate response
        result = self._local_llm_client.chat(
            messages=local_messages,
            language=language,
            user_role=user_role,
            stream=stream
        )

        return LLMResponse(
            content=result['response'],
            provider=LLMProvider.LOCAL.value,
            model=result['model'],
            tokens_used={
                'prompt': 0,  # Not tracked separately in local
                'completion': result['tokens_used'],
                'total': result['tokens_used']
            },
            cost_usd=0.0,  # Local is FREE!
            finish_reason='stop',
            metadata={
                'temperature': self.temperature,
                'max_tokens': self.max_tokens,
                'device': result.get('device', 'cpu'),
                'generation_time': result.get('generation_time', 0),
                'cached': result.get('cached', False)
            }
        )

    def _chat_anthropic(self, messages: List[LLMMessage], stream: bool) -> LLMResponse:
        """Generate response using Anthropic Claude."""
        if not self._anthropic_client:
            raise Exception("Anthropic client not initialized")

        model_config = self.MODEL_CONFIGS[self.quality][LLMProvider.ANTHROPIC]
        model = model_config['model']

        # Separate system message from conversation messages
        system_msg = next((msg.content for msg in messages if msg.role == 'system'), None)
        conversation_msgs = [
            {"role": msg.role, "content": msg.content}
            for msg in messages if msg.role != 'system'
        ]

        response = self._anthropic_client.messages.create(
            model=model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            system=system_msg,
            messages=conversation_msgs,
            stream=stream
        )

        if stream:
            # TODO: Implement streaming support
            raise NotImplementedError("Streaming not yet implemented")

        # Calculate cost
        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens
        total_tokens = prompt_tokens + completion_tokens

        cost_usd = (
            (prompt_tokens / 1000) * model_config['cost_per_1k_input'] +
            (completion_tokens / 1000) * model_config['cost_per_1k_output']
        )

        return LLMResponse(
            content=response.content[0].text,
            provider=LLMProvider.ANTHROPIC.value,
            model=model,
            tokens_used={
                'prompt': prompt_tokens,
                'completion': completion_tokens,
                'total': total_tokens
            },
            cost_usd=cost_usd,
            finish_reason=response.stop_reason,
            metadata={
                'temperature': self.temperature,
                'max_tokens': self.max_tokens
            }
        )

    def generate_conversation_title(self, first_message: str) -> str:
        """Generate a short title for a conversation based on first message."""
        try:
            messages = [
                LLMMessage(
                    role='user',
                    content=f"Generate a short (3-5 words) title for a conversation that starts with: '{first_message[:200]}'. Only return the title, nothing else."
                )
            ]

            # Use fast quality for title generation
            original_quality = self.quality
            self.quality = LLMQuality.FAST
            response = self.chat(messages, system_prompt_type='general')
            self.quality = original_quality

            return response.content.strip().strip('"\'')
        except Exception as e:
            logger.error(f"Failed to generate conversation title: {e}")
            return first_message[:50] + ('...' if len(first_message) > 50 else '')

    def should_use_llm(self, user_message: str, intent_confidence: float) -> bool:
        """
        Determine if LLM should be used instead of intent-based response.

        Returns True if:
        - No clear intent detected (low confidence)
        - Message is conversational/open-ended
        - Message requires reasoning or explanation
        """
        # Use LLM for low-confidence intents
        if intent_confidence < 0.5:
            return True

        # Keywords that suggest open-ended conversation
        conversational_keywords = [
            'why', 'how', 'explain', 'tell me about', 'what do you think',
            'nega', 'qanday', 'tushuntir', 'aytib ber',  # Uzbek
            'почему', 'как', 'объясни', 'расскажи',  # Russian
        ]

        message_lower = user_message.lower()
        for keyword in conversational_keywords:
            if keyword in message_lower:
                return True

        return False


class ConversationManager:
    """
    Manages conversation context and history for multi-turn dialogs.
    """

    def __init__(self, conversation_id: str, max_history: int = 10):
        """
        Initialize conversation manager.

        Args:
            conversation_id: Unique conversation identifier
            max_history: Maximum messages to keep in context
        """
        self.conversation_id = conversation_id
        self.max_history = max_history
        self.cache_key = f"llm_conversation:{conversation_id}"
        self.cache_ttl = 3600  # 1 hour

    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Add a message to conversation history."""
        messages = self.get_history()
        messages.append({
            'role': role,
            'content': content,
            'metadata': metadata or {},
            'timestamp': __import__('datetime').datetime.now().isoformat()
        })

        # Keep only recent messages
        if len(messages) > self.max_history:
            messages = messages[-self.max_history:]

        cache.set(self.cache_key, messages, self.cache_ttl)

    def get_history(self) -> List[Dict]:
        """Get conversation history."""
        return cache.get(self.cache_key, [])

    def get_llm_messages(self) -> List[LLMMessage]:
        """Convert history to LLM message format."""
        history = self.get_history()
        return [
            LLMMessage(role=msg['role'], content=msg['content'], metadata=msg.get('metadata'))
            for msg in history
        ]

    def clear(self):
        """Clear conversation history."""
        cache.delete(self.cache_key)

    def get_context_summary(self) -> str:
        """Generate a summary of conversation context."""
        history = self.get_history()
        if not history:
            return "No previous messages"

        return f"{len(history)} messages in conversation"


# Convenience functions
def create_llm_service(quality: str = 'balanced') -> LLMService:
    """Create an LLM service instance with specified quality."""
    quality_map = {
        'fast': LLMQuality.FAST,
        'balanced': LLMQuality.BALANCED,
        'high': LLMQuality.HIGH,
        'premium': LLMQuality.PREMIUM,
    }
    return LLMService(quality=quality_map.get(quality, LLMQuality.BALANCED))


def chat_with_llm(
    message: str,
    conversation_id: Optional[str] = None,
    user_context: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Simplified chat interface with LLM.

    Args:
        message: User message
        conversation_id: Optional conversation ID for context
        user_context: User context (role, language, etc.)

    Returns:
        Dict with 'response', 'cost', 'provider', etc.
    """
    llm = create_llm_service()

    # Load conversation history if available
    messages = []
    if conversation_id:
        conv_mgr = ConversationManager(conversation_id)
        messages = conv_mgr.get_llm_messages()
        conv_mgr.add_message('user', message)

    # Add current message
    messages.append(LLMMessage(role='user', content=message))

    # Get response
    response = llm.chat(
        messages=messages,
        user_context=user_context,
        system_prompt_type=user_context.get('user_role', 'general') if user_context else 'general'
    )

    # Save assistant response
    if conversation_id:
        conv_mgr.add_message('assistant', response.content, metadata={
            'provider': response.provider,
            'model': response.model,
            'tokens': response.tokens_used,
            'cost': response.cost_usd
        })

    return {
        'response': response.content,
        'provider': response.provider,
        'model': response.model,
        'tokens_used': response.tokens_used,
        'cost_usd': response.cost_usd,
        'finish_reason': response.finish_reason
    }

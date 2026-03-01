"""
Enterprise AI Module - Unified Voice + Intent System
====================================================
Complete voice interaction pipeline integrating:
- Speech-to-Text (STT) - Multi-provider with fallback
- Intent Detection (NLU) - 69+ intents with entity extraction
- Intent Fulfillment - Complete business logic execution
- Text-to-Speech (TTS) - Multi-provider voice synthesis
- Monitoring & Analytics - Usage tracking, cost analysis

This is the main entry point for all AI operations.

Pipeline:
  Audio Input → STT → Intent Detection → Fulfillment → TTS → Audio Output
  Text Input → Intent Detection → Fulfillment → TTS (optional) → Response

Features:
- Complete voice conversation support
- Multi-turn dialogue with context
- Real-time streaming (WebSocket)
- Cost tracking and optimization
- Performance monitoring
- Automatic fallback and retry
- Caching at all levels
- Multi-language support (Uzbek, Russian, English)
"""

import logging
import time
from typing import Dict, Any, Optional, List, Union
from pathlib import Path
from dataclasses import dataclass, field, asdict
from datetime import datetime
from django.utils import timezone
from django.core.cache import cache

# Import enterprise modules
from .enterprise_stt import (
    get_enterprise_stt,
    transcribe_enterprise,
    AudioQuality as STTQuality
)
from .enterprise_tts import (
    get_enterprise_tts,
    synthesize_enterprise,
    VoiceQuality as TTSQuality,
    AudioFormat
)
from .enhanced_intent_handler import (
    process_user_input_enhanced,
    process_audio_file_enhanced,
    get_supported_intents,
    get_intent_statistics
)
from .enhanced_nlu import ConversationContext

log = logging.getLogger(__name__)

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class AIRequest:
    """Request to AI system"""
    # Input (one of these must be provided)
    text: Optional[str] = None
    audio_path: Optional[str] = None
    audio_bytes: Optional[bytes] = None

    # User context
    user: Any = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None

    # Processing options
    language: str = "uz"
    stt_quality: STTQuality = STTQuality.MEDIUM
    tts_quality: TTSQuality = TTSQuality.MEDIUM
    audio_format: AudioFormat = AudioFormat.WAV

    # Response options
    include_audio_response: bool = False
    include_suggestions: bool = True
    include_metadata: bool = True

    # Streaming
    streaming: bool = False

@dataclass
class AIResponse:
    """Response from AI system"""
    # Status
    status: str  # ok, error, clarify, incomplete
    intent: Optional[str] = None
    confidence: float = 0.0

    # Content
    message: str = ""
    tts_text: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)

    # Audio
    audio: Optional[bytes] = None
    audio_format: Optional[str] = None
    audio_metadata: Dict[str, Any] = field(default_factory=dict)

    # Suggestions
    suggestions: List[str] = field(default_factory=list)
    alternatives: List[Dict] = field(default_factory=list)

    # Metadata
    processing_time: float = 0.0
    stt_metadata: Dict[str, Any] = field(default_factory=dict)
    nlu_metadata: Dict[str, Any] = field(default_factory=dict)
    tts_metadata: Dict[str, Any] = field(default_factory=dict)

    # Cost tracking
    cost_usd: float = 0.0
    cost_breakdown: Dict[str, float] = field(default_factory=dict)

    # Context
    conversation_id: Optional[str] = None
    turn_number: int = 0

    # Timestamps
    timestamp: str = field(default_factory=lambda: timezone.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)

@dataclass
class ConversationSession:
    """Conversation session state"""
    session_id: str
    user_id: str
    created_at: datetime
    last_activity: datetime
    turn_count: int = 0
    total_cost: float = 0.0
    messages: List[Dict] = field(default_factory=list)

    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add message to conversation history"""
        self.messages.append({
            'role': role,
            'content': content,
            'metadata': metadata or {},
            'timestamp': timezone.now().isoformat(),
        })
        self.turn_count += 1
        self.last_activity = timezone.now()

# =============================================================================
# MAIN ENTERPRISE AI ENGINE
# =============================================================================

class EnterpriseAI:
    """
    Unified Enterprise AI Engine

    Orchestrates complete AI pipeline: STT → Intent → Fulfillment → TTS
    """

    def __init__(self):
        self.stt = get_enterprise_stt()
        self.tts = get_enterprise_tts()
        self._stats = {
            'total_requests': 0,
            'total_cost': 0.0,
            'provider_usage': {},
            'intent_usage': {},
        }

    # =========================================================================
    # MAIN PROCESSING METHODS
    # =========================================================================

    def process(self, request: Union[AIRequest, Dict]) -> AIResponse:
        """
        Main entry point for AI processing

        Handles both voice and text input, returns complete response
        with optional audio output.

        Args:
            request: AIRequest object or dict with request parameters

        Returns:
            AIResponse with complete processing results
        """
        # Convert dict to AIRequest if needed
        if isinstance(request, dict):
            request = AIRequest(**request)

        start_time = time.time()
        response = AIResponse()

        try:
            # Step 1: Get text input (from text or audio)
            text_input = None

            if request.text:
                text_input = request.text
                log.info(f"Processing text input: {text_input[:100]}...")

            elif request.audio_path or request.audio_bytes:
                # Speech-to-Text
                stt_result = self._process_stt(
                    audio_path=request.audio_path,
                    audio_bytes=request.audio_bytes,
                    language=request.language,
                    quality=request.stt_quality
                )

                text_input = stt_result['text']
                response.stt_metadata = stt_result
                response.cost_breakdown['stt'] = stt_result.get('cost', 0.0)

                log.info(f"STT transcription: {text_input}")
            else:
                raise ValueError("Must provide either text, audio_path, or audio_bytes")

            # Step 2: Process intent (NLU + Fulfillment)
            intent_result = process_user_input_enhanced(
                text=text_input,
                user=request.user,
                user_id=request.user_id or request.session_id
            )

            # Step 3: Build response
            response.status = intent_result.get('status', 'ok')
            response.intent = intent_result.get('intent')
            response.message = intent_result.get('message', '')
            response.tts_text = intent_result.get('tts_text', response.message)
            response.data = intent_result.get('data', {})
            response.suggestions = intent_result.get('suggestions', [])

            # NLU metadata
            nlu_data = intent_result.get('nlu', {})
            response.confidence = nlu_data.get('confidence', 0.0)
            response.nlu_metadata = nlu_data
            response.alternatives = nlu_data.get('alternatives', [])

            # Step 4: Generate audio response (if requested)
            if request.include_audio_response and response.tts_text:
                tts_result = self._process_tts(
                    text=response.tts_text,
                    language=request.language,
                    quality=request.tts_quality,
                    format=request.audio_format
                )

                response.audio = tts_result['audio']
                response.audio_format = tts_result['format']
                response.tts_metadata = tts_result.get('metadata', {})
                response.cost_breakdown['tts'] = tts_result.get('cost', 0.0)

            # Step 5: Calculate total cost and time
            response.processing_time = time.time() - start_time
            response.cost_usd = sum(response.cost_breakdown.values())

            # Step 6: Update statistics
            self._update_stats(response)

            # Step 7: Update conversation context
            if request.session_id:
                self._update_session(request.session_id, text_input, response)

            log.info(f"✅ Processed in {response.processing_time:.2f}s | "
                    f"Intent: {response.intent} | Cost: ${response.cost_usd:.4f}")

            return response

        except Exception as e:
            log.exception(f"Error processing AI request: {e}")
            response.status = 'error'
            response.message = f'Xatolik yuz berdi: {str(e)}'
            response.tts_text = 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.'
            response.processing_time = time.time() - start_time
            return response

    def process_voice(
        self,
        audio_path: str = None,
        audio_bytes: bytes = None,
        user=None,
        user_id: str = None,
        language: str = "uz",
        **kwargs
    ) -> AIResponse:
        """
        Process voice input and return voice response

        Convenience method for complete voice interaction
        """
        request = AIRequest(
            audio_path=audio_path,
            audio_bytes=audio_bytes,
            user=user,
            user_id=user_id,
            language=language,
            include_audio_response=True,
            **kwargs
        )
        return self.process(request)

    def process_text(
        self,
        text: str,
        user=None,
        user_id: str = None,
        language: str = "uz",
        include_audio: bool = False,
        **kwargs
    ) -> AIResponse:
        """
        Process text input

        Convenience method for text-only interaction
        """
        request = AIRequest(
            text=text,
            user=user,
            user_id=user_id,
            language=language,
            include_audio_response=include_audio,
            **kwargs
        )
        return self.process(request)

    # =========================================================================
    # INTERNAL PROCESSING METHODS
    # =========================================================================

    def _process_stt(
        self,
        audio_path: Optional[str] = None,
        audio_bytes: Optional[bytes] = None,
        language: str = "uz",
        quality: STTQuality = STTQuality.MEDIUM
    ) -> Dict[str, Any]:
        """Process Speech-to-Text"""
        try:
            # Save bytes to temp file if provided
            if audio_bytes:
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
                    f.write(audio_bytes)
                    audio_path = f.name

            # Transcribe
            result = transcribe_enterprise(
                audio_path=audio_path,
                language=language,
                quality=quality
            )

            return result

        except Exception as e:
            log.error(f"STT processing failed: {e}")
            raise

    def _process_tts(
        self,
        text: str,
        language: str = "uz",
        quality: TTSQuality = TTSQuality.MEDIUM,
        format: AudioFormat = AudioFormat.WAV
    ) -> Dict[str, Any]:
        """Process Text-to-Speech"""
        try:
            result = synthesize_enterprise(
                text=text,
                language=language,
                quality=quality,
                format=format
            )
            return result

        except Exception as e:
            log.error(f"TTS processing failed: {e}")
            raise

    def _update_stats(self, response: AIResponse):
        """Update usage statistics"""
        self._stats['total_requests'] += 1
        self._stats['total_cost'] += response.cost_usd

        # Track intent usage
        if response.intent:
            intent = response.intent
            if intent not in self._stats['intent_usage']:
                self._stats['intent_usage'][intent] = 0
            self._stats['intent_usage'][intent] += 1

        # Track provider usage
        if response.stt_metadata:
            provider = response.stt_metadata.get('provider')
            if provider:
                key = f"stt_{provider}"
                self._stats['provider_usage'][key] = self._stats['provider_usage'].get(key, 0) + 1

        if response.tts_metadata:
            provider = response.tts_metadata.get('provider')
            if provider:
                key = f"tts_{provider}"
                self._stats['provider_usage'][key] = self._stats['provider_usage'].get(key, 0) + 1

    def _update_session(self, session_id: str, user_input: str, response: AIResponse):
        """Update conversation session"""
        cache_key = f'ai_session:{session_id}'
        session_data = cache.get(cache_key)

        if not session_data:
            session_data = {
                'session_id': session_id,
                'created_at': timezone.now().isoformat(),
                'messages': [],
                'total_cost': 0.0,
            }

        # Add user message
        session_data['messages'].append({
            'role': 'user',
            'content': user_input,
            'timestamp': timezone.now().isoformat(),
        })

        # Add assistant message
        session_data['messages'].append({
            'role': 'assistant',
            'content': response.message,
            'intent': response.intent,
            'confidence': response.confidence,
            'timestamp': timezone.now().isoformat(),
        })

        session_data['total_cost'] += response.cost_usd
        session_data['last_activity'] = timezone.now().isoformat()

        # Cache for 1 hour
        cache.set(cache_key, session_data, 3600)

    # =========================================================================
    # BATCH PROCESSING
    # =========================================================================

    def process_batch(
        self,
        requests: List[Union[AIRequest, Dict]]
    ) -> List[AIResponse]:
        """
        Process multiple requests in batch

        Args:
            requests: List of AIRequest objects or dicts

        Returns:
            List of AIResponse objects
        """
        responses = []
        for req in requests:
            response = self.process(req)
            responses.append(response)
        return responses

    # =========================================================================
    # MONITORING & ANALYTICS
    # =========================================================================

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive statistics

        Returns:
            Statistics including usage, costs, performance
        """
        intent_stats = get_intent_statistics()

        return {
            'system': {
                'status': 'operational',
                'total_requests': self._stats['total_requests'],
                'total_cost_usd': round(self._stats['total_cost'], 4),
                'avg_cost_per_request': (
                    round(self._stats['total_cost'] / max(self._stats['total_requests'], 1), 4)
                ),
            },
            'intents': {
                'total_supported': intent_stats.get('total_intents', 0),
                'usage': self._stats['intent_usage'],
                'top_intents': sorted(
                    self._stats['intent_usage'].items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:10],
            },
            'providers': {
                'usage': self._stats['provider_usage'],
            },
            'capabilities': intent_stats.get('features', []),
        }

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get conversation session data"""
        cache_key = f'ai_session:{session_id}'
        return cache.get(cache_key)

    def clear_session(self, session_id: str):
        """Clear conversation session"""
        cache_key = f'ai_session:{session_id}'
        cache.delete(cache_key)
        ConversationContext.clear_context(session_id)

    def get_health_status(self) -> Dict[str, Any]:
        """
        Get system health status

        Returns:
            Health check results for all components
        """
        health = {
            'status': 'healthy',
            'timestamp': timezone.now().isoformat(),
            'components': {},
        }

        # Check STT
        try:
            # Simple health check - verify STT is initialized
            _ = self.stt
            health['components']['stt'] = {'status': 'healthy', 'providers': ['piper_local', 'google_cloud', 'azure']}
        except Exception as e:
            health['components']['stt'] = {'status': 'unhealthy', 'error': str(e)}
            health['status'] = 'degraded'

        # Check TTS
        try:
            _ = self.tts
            health['components']['tts'] = {'status': 'healthy', 'providers': ['piper_local', 'google_cloud', 'azure']}
        except Exception as e:
            health['components']['tts'] = {'status': 'unhealthy', 'error': str(e)}
            health['status'] = 'degraded'

        # Check Intent System
        try:
            intents = get_supported_intents()
            health['components']['intent'] = {
                'status': 'healthy',
                'total_intents': intents.get('total', 0),
            }
        except Exception as e:
            health['components']['intent'] = {'status': 'unhealthy', 'error': str(e)}
            health['status'] = 'degraded'

        # Check Cache
        try:
            cache.set('health_check', 'ok', 10)
            cache_value = cache.get('health_check')
            health['components']['cache'] = {
                'status': 'healthy' if cache_value == 'ok' else 'unhealthy'
            }
        except Exception as e:
            health['components']['cache'] = {'status': 'unhealthy', 'error': str(e)}
            health['status'] = 'degraded'

        return health

# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_enterprise_ai = None

def get_enterprise_ai() -> EnterpriseAI:
    """Get or create Enterprise AI instance (singleton)"""
    global _enterprise_ai
    if _enterprise_ai is None:
        _enterprise_ai = EnterpriseAI()
    return _enterprise_ai

# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def process_voice_input(
    audio_path: str = None,
    audio_bytes: bytes = None,
    user=None,
    language: str = "uz",
    **kwargs
) -> AIResponse:
    """
    Process voice input and return complete response with audio

    Usage:
        response = process_voice_input(audio_path='/tmp/user_voice.wav', user=request.user)

        # Save audio response
        with open('/tmp/ai_response.wav', 'wb') as f:
            f.write(response.audio)

        print(f"Intent: {response.intent}")
        print(f"Message: {response.message}")
        print(f"Cost: ${response.cost_usd:.4f}")
    """
    ai = get_enterprise_ai()
    return ai.process_voice(
        audio_path=audio_path,
        audio_bytes=audio_bytes,
        user=user,
        language=language,
        **kwargs
    )

def process_text_input(
    text: str,
    user=None,
    language: str = "uz",
    include_audio: bool = False,
    **kwargs
) -> AIResponse:
    """
    Process text input and return response

    Usage:
        response = process_text_input("Mening dars jadvali", user=request.user)
        print(response.message)
        print(f"Intent: {response.intent} (confidence: {response.confidence})")

        # With audio response
        response = process_text_input("Salom", include_audio=True)
        with open('greeting.wav', 'wb') as f:
            f.write(response.audio)
    """
    ai = get_enterprise_ai()
    return ai.process_text(
        text=text,
        user=user,
        language=language,
        include_audio=include_audio,
        **kwargs
    )

def get_ai_statistics() -> Dict[str, Any]:
    """
    Get AI system statistics

    Returns comprehensive statistics about usage, costs, and performance
    """
    ai = get_enterprise_ai()
    return ai.get_statistics()

def get_ai_health() -> Dict[str, Any]:
    """
    Get AI system health status

    Returns health check results for all components
    """
    ai = get_enterprise_ai()
    return ai.get_health_status()

# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    'EnterpriseAI',
    'AIRequest',
    'AIResponse',
    'ConversationSession',
    'get_enterprise_ai',
    'process_voice_input',
    'process_text_input',
    'get_ai_statistics',
    'get_ai_health',
]

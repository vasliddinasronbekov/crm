"""
Enhanced Intent Handler - Main Integration Layer
===============================================
Orchestrates the complete intent processing pipeline:
1. NLU Processing (intent detection + entity extraction)
2. Intent Fulfillment (execute actions)
3. Response Generation (voice-friendly + text)
4. Context Management (multi-turn conversations)

This is the main entry point replacing the old intent_handler.py
"""

import logging
from typing import Dict, Any, Optional
from django.utils import timezone

from .enhanced_nlu import (
    process_nlu,
    ConversationContext,
    get_nlu_processor,
)
from .intent_fulfillment import fulfill_intent
from .intent_config import get_intent_config, TOTAL_INTENTS

log = logging.getLogger(__name__)

# =============================================================================
# MAIN INTENT HANDLER
# =============================================================================

def handle_nlu_result_sync(
    nlu: Dict[str, Any],
    transcript: str = None,
    user=None,
    entities: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Main NLU result handler (backward compatible with old interface)

    Args:
        nlu: NLU result dict with intent and confidence
        transcript: Original user input text
        user: Django User object
        entities: Extracted entities (optional, will be extracted if not provided)

    Returns:
        Complete response dict with status, message, data, tts_text
    """
    intent = nlu.get('intent', 'unknown')
    confidence = nlu.get('confidence', 0.0)

    log.info(f"Processing intent: {intent} (confidence: {confidence:.2f})")

    # Low confidence handling
    if confidence < 0.4:
        return {
            'status': 'clarify',
            'intent': intent,
            'confidence': confidence,
            'message': 'Nimani nazarda tutyapsiz? Iltimos, aniqroq ayting.',
            'tts_text': 'Iltimos, aniqroq ayting.',
            'suggestions': [
                'Kurs haqida ma\'lumot',
                'To\'lovni tekshirish',
                'Dars jadvali',
                'Test natijalari',
            ],
        }

    # Use entities from NLU if not provided
    if entities is None:
        entities = nlu.get('entities', {})

    # Fulfill intent
    result = fulfill_intent(
        intent=intent,
        entities=entities,
        user=user,
        transcript=transcript or ""
    )

    # Add NLU metadata
    result['nlu'] = {
        'intent': intent,
        'confidence': confidence,
        'method': nlu.get('method', 'unknown'),
        'entities': entities,
    }

    return result


def process_user_input_enhanced(
    text: str,
    user=None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enhanced version of process_user_input using new NLU system

    Args:
        text: User input text
        user: Django User object
        user_id: User ID for context management

    Returns:
        Complete response with status, intent, message, data, tts_text
    """
    if not text or not text.strip():
        return {
            'status': 'error',
            'message': 'Matn bo\'sh. Iltimos, biror narsa yozing.',
            'tts_text': 'Iltimos, biror narsa yozing.',
        }

    try:
        # Step 1: NLU Processing
        nlu_result = process_nlu(
            text=text,
            user=user,
            user_id=user_id or (str(user.id) if user else None)
        )

        log.info(f"NLU Result: {nlu_result.get('intent')} "
                f"(confidence: {nlu_result.get('confidence', 0):.2f})")

        # Step 2: Handle incomplete intents (missing entities)
        if nlu_result.get('status') == 'incomplete':
            return {
                'status': 'incomplete',
                'intent': nlu_result['intent'],
                'message': nlu_result.get('prompt', 'Qo\'shimcha ma\'lumot kerak.'),
                'tts_text': nlu_result.get('prompt', 'Qo\'shimcha ma\'lumot kerak.'),
                'missing_entities': nlu_result.get('missing_entities', []),
                'entities': nlu_result.get('entities', {}),
            }

        # Step 3: Handle authentication required
        if nlu_result.get('status') == 'error' and nlu_result.get('error') == 'authentication_required':
            return {
                'status': 'error',
                'intent': nlu_result['intent'],
                'message': 'Iltimos, tizimga kiring.',
                'tts_text': 'Iltimos, tizimga kiring.',
                'requires_login': True,
            }

        # Step 4: Handle clarification needed
        if nlu_result.get('status') == 'clarify':
            return {
                'status': 'clarify',
                'intent': nlu_result.get('intent', 'unknown'),
                'message': nlu_result.get('message', 'Aniqroq ayting.'),
                'tts_text': 'Aniqroq ayting.',
                'suggestions': nlu_result.get('suggestions', []),
            }

        # Step 5: Fulfill intent
        intent = nlu_result.get('intent', 'unknown')
        entities = nlu_result.get('entities', {})

        fulfillment_result = fulfill_intent(
            intent=intent,
            entities=entities,
            user=user,
            transcript=text
        )

        # Step 6: Update conversation context
        if user_id or user:
            uid = user_id or str(user.id)
            ConversationContext.update_context(
                user_id=uid,
                intent=intent,
                entities=entities,
                status=fulfillment_result.get('status', 'complete')
            )

        # Step 7: Merge NLU and fulfillment results
        response = {
            **fulfillment_result,
            'nlu': {
                'intent': intent,
                'confidence': nlu_result.get('confidence', 0.0),
                'method': nlu_result.get('method', 'unknown'),
                'entities': entities,
                'alternatives': nlu_result.get('alternatives', []),
            },
            'timestamp': timezone.now().isoformat(),
        }

        return response

    except Exception as e:
        log.exception(f"Error processing user input: {e}")
        return {
            'status': 'error',
            'message': f'Xatolik yuz berdi: {str(e)}',
            'tts_text': 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.',
            'error': str(e),
            'timestamp': timezone.now().isoformat(),
        }


def process_audio_file_enhanced(
    audio_path: str,
    user=None,
    user_id: Optional[str] = None,
    language: str = 'uz'
) -> Dict[str, Any]:
    """
    Enhanced audio processing with new NLU system

    Args:
        audio_path: Path to audio file
        user: Django User object
        user_id: User ID for context
        language: Language code (uz, ru, en)

    Returns:
        Complete response with transcription and intent processing
    """
    try:
        # Step 1: Speech-to-Text
        from .services import transcribe_audio

        raw_text, duration = transcribe_audio(
            path=audio_path,
            language=language
        )

        log.info(f"Transcribed: '{raw_text}' ({duration:.2f}s)")

        # Step 2: Process transcribed text
        result = process_user_input_enhanced(
            text=raw_text,
            user=user,
            user_id=user_id
        )

        # Step 3: Add audio metadata
        result['audio'] = {
            'raw_transcription': raw_text,
            'duration_seconds': duration,
            'language': language,
        }

        return result

    except FileNotFoundError:
        return {
            'status': 'error',
            'message': 'Audio fayl topilmadi.',
            'tts_text': 'Audio fayl topilmadi.',
            'error': 'File not found',
        }
    except Exception as e:
        log.exception(f"Audio processing error: {e}")
        return {
            'status': 'error',
            'message': f'Audio qayta ishlashda xatolik: {str(e)}',
            'tts_text': 'Audio qayta ishlashda xatolik yuz berdi.',
            'error': str(e),
        }


# =============================================================================
# BATCH PROCESSING
# =============================================================================

def process_batch_intents(
    inputs: list,
    user=None,
    user_id: Optional[str] = None
) -> list:
    """
    Process multiple inputs in batch

    Args:
        inputs: List of text inputs
        user: Django User object
        user_id: User ID for context

    Returns:
        List of results
    """
    results = []
    for text in inputs:
        result = process_user_input_enhanced(text, user, user_id)
        results.append(result)
    return results


# =============================================================================
# STATISTICS AND MONITORING
# =============================================================================

def get_intent_statistics() -> Dict[str, Any]:
    """
    Get statistics about intent usage

    Returns:
        Statistics dictionary
    """
    from django.core.cache import cache

    # This would typically pull from a database or analytics system
    # For now, return basic info
    return {
        'total_intents': TOTAL_INTENTS,
        'system_status': 'operational',
        'nlu_engine': 'enhanced_multi_strategy',
        'supported_languages': ['uz', 'ru', 'en'],
        'features': [
            'multi_strategy_intent_detection',
            'entity_extraction',
            'context_management',
            'multi_turn_conversations',
            '50plus_intents',
            'voice_and_text_support',
        ],
    }


def get_supported_intents() -> Dict[str, Any]:
    """
    Get list of all supported intents with descriptions

    Returns:
        Dictionary of intents by category
    """
    from .intent_config import INTENT_DEFINITIONS, IntentCategory

    intents_by_category = {}

    for intent_name, config in INTENT_DEFINITIONS.items():
        category = config.category.value

        if category not in intents_by_category:
            intents_by_category[category] = []

        intents_by_category[category].append({
            'name': intent_name,
            'description': config.description,
            'examples': config.examples[:2],  # First 2 examples
        })

    return {
        'total': TOTAL_INTENTS,
        'by_category': intents_by_category,
    }


# =============================================================================
# TESTING UTILITIES
# =============================================================================

def test_intent_detection(test_cases: list) -> Dict[str, Any]:
    """
    Test intent detection with multiple test cases

    Args:
        test_cases: List of dicts with 'text' and 'expected_intent'

    Returns:
        Test results with accuracy metrics
    """
    processor = get_nlu_processor()
    results = []
    correct = 0

    for case in test_cases:
        text = case['text']
        expected = case.get('expected_intent')

        nlu_result = processor.process(text)
        detected = nlu_result['intent']

        is_correct = detected == expected
        if is_correct:
            correct += 1

        results.append({
            'text': text,
            'expected': expected,
            'detected': detected,
            'confidence': nlu_result['confidence'],
            'correct': is_correct,
        })

    accuracy = (correct / len(test_cases)) * 100 if test_cases else 0

    return {
        'total_cases': len(test_cases),
        'correct': correct,
        'incorrect': len(test_cases) - correct,
        'accuracy': round(accuracy, 2),
        'results': results,
    }


# =============================================================================
# EXPORT BACKWARD-COMPATIBLE INTERFACE
# =============================================================================

# Main exports (backward compatible)
__all__ = [
    'handle_nlu_result_sync',  # Old interface
    'process_user_input_enhanced',  # New interface
    'process_audio_file_enhanced',
    'process_batch_intents',
    'get_intent_statistics',
    'get_supported_intents',
    'test_intent_detection',
]

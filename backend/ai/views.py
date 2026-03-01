from .services_tts import text_to_speech
from rest_framework.parsers import JSONParser
from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
import tempfile
import os
import logging
from drf_spectacular.utils import extend_schema, OpenApiTypes
from .serializers import (
    STTRequestSerializer, STTResponseSerializer,
    ApplyIntentSerializer, AIIntentRequestSerializer, AIIntentResponseSerializer,
    TTSRequestSerializer, TTSResponseSerializer 
)

from .services import transcribe_audio, spell_correct, extract_intent, extract_entities, get_whisper_model
from .tasks import stt_and_parse
from .intent_handler import handle_nlu_result_sync
from .voice_navigation import process_navigation_command, get_voice_commands
from .hybrid_ai_handler import get_hybrid_handler

log = logging.getLogger(__name__)

# ----------- TTS View  -----------
@extend_schema(
    request=TTSRequestSerializer,
    responses={200: OpenApiTypes.BINARY},  # Use OpenApiTypes.BINARY for binary responses (file)
    description="Convert text to speech (Uzbek TTS, offline, Coqui VITS model)."
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tts_view(request):
    """
    Convert text to speech and return WAV file.
    """
    text = request.data.get("text")
    if not text:
        return Response({"detail": "Text required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Generate speech and get temp file path
        language = request.data.get("language", "uz")  # default to Uzbek
        speaker = request.data.get("speaker", None)

        out_path = text_to_speech(text, speaker=speaker, language=language)

        # Return the audio file
        response = FileResponse(
            open(out_path, "rb"),
            content_type="audio/wav",
            as_attachment=True,
            filename="tts_output.wav"
        )

        # Clean up temp file after response is sent
        # Note: FileResponse will handle file closure, but we should clean up temp file
        # We can't delete immediately as FileResponse needs to read it
        return response
    except Exception as e:
        log.exception("TTS generation failed")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ----------- STT View (Synchronous) -----------
@extend_schema(
    request=STTRequestSerializer,
    responses=STTResponseSerializer,
    description="Upload an audio file and get STT result (raw + corrected)"
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stt_view(request):
    """
    Immediate STT: POST file=@wav
    Returns raw, corrected, duration
    """
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        for chunk in file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        # Process speech-to-text
        raw_text, duration = transcribe_audio(tmp_path)
        
        # Correct text
        corrected = spell_correct(raw_text)

        return Response({"raw": raw_text, "corrected": corrected, "duration": duration})
    except Exception as e:
        log.exception("stt_view error")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


# ----------- STT View (Asynchronous) -----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stt_async_view(request):
    """
    Async STT (Celery): returns task id or synchronous fallback result id.
    """
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        for chunk in file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        # Trigger asynchronous processing with Celery
        task = stt_and_parse.delay(tmp_path)
        
        return Response({"task_id": getattr(task, "id", None)})
    except Exception as e:
        log.exception("stt_async_view error")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


# ----------- Intent Extraction View (Synchronous) -----------
@extend_schema(
    request=AIIntentRequestSerializer,
    responses=AIIntentResponseSerializer,
    description="Extract intent and run business logic (requires auth)"
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def intent_view(request):
    """
    Extracts intent from text and runs business logic (requires authentication).
    """
    serializer = AIIntentRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    text = serializer.validated_data["text"]

    try:
        # Extract intent and entities from the text
        nlu = extract_intent(text)
        nlu["entities"] = extract_entities(text)

        # Process intent with business logic
        result = handle_nlu_result_sync(nlu, transcript=text, user=request.user)

        return Response({"nlu": nlu, "result": result})
    except Exception as e:
        log.exception("intent_view error")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ----------- Intent Application View (External Systems) -----------
@extend_schema(
    request=ApplyIntentSerializer,
    responses=AIIntentResponseSerializer,
    description="Apply precomputed intent (external systems, no auth required)"
)
@api_view(["POST"])
@permission_classes([AllowAny])
def apply_intent(request):
    """
    External systems can call this to apply precomputed intent payloads.
    """
    try:
        nlu = request.data.get("nlu") or request.data
        user = None  # Allow anonymous access

        # Process intent with business logic
        result = handle_nlu_result_sync(nlu, transcript=nlu.get("transcript"), user=user)

        return Response(result)
    except Exception as e:
        log.exception("apply_intent error")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ----------- Voice Navigation View -----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def voice_navigation_view(request):
    """
    Process voice navigation command.

    Request:
    {
        "command": "open dashboard",
        "language": "en"  # optional
    }

    Response:
    {
        "action_type": "navigate",
        "target": "dashboard",
        "params": {},
        "message": "Opening dashboard"
    }
    """
    try:
        command = request.data.get("command", "")
        if not command:
            return Response(
                {"detail": "command is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process navigation command
        result = process_navigation_command(command, user=request.user)

        return Response(result)

    except Exception as e:
        log.exception("voice_navigation_view error")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ----------- Get Voice Commands View -----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def voice_commands_list_view(request):
    """
    Get list of available voice commands.

    Query params:
    - language: Language code (en, uz, ru)

    Response:
    {
        "commands": ["open dashboard", "show schedule", ...]
    }
    """
    try:
        language = request.query_params.get("language", "en")
        commands = get_voice_commands(language)

        return Response({"commands": commands})

    except Exception as e:
        log.exception("voice_commands_list_view error")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ----------- Hybrid AI Chat View -----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def hybrid_chat_view(request):
    """
    Process message with hybrid AI (Intent + LLM).

    Request:
    {
        "text": "What's my schedule?",
        "conversation_id": "user_123_conv_1",  # optional
        "language": "en",  # optional (auto-detect if not provided)
        "mode": "auto"  # auto, intent, llm
    }

    Response:
    {
        "status": "ok",
        "response": "Your next classes are...",
        "intent": "student_schedule",
        "confidence": 0.95,
        "data": {...},
        "metadata": {
            "processing_mode": "intent",
            "detected_intent": "student_schedule",
            "processing_time_seconds": 0.123
        }
    }
    """
    try:
        text = request.data.get("text", "")
        if not text:
            return Response(
                {"detail": "text is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        conversation_id = request.data.get("conversation_id")
        language = request.data.get("language")
        force_mode = request.data.get("mode")

        # Build user context
        user_context = {}
        if language:
            user_context['language'] = language

        # Process with hybrid AI
        handler = get_hybrid_handler()
        result = handler.process(
            text=text,
            user=request.user,
            conversation_id=conversation_id,
            user_context=user_context,
            force_mode=force_mode
        )

        return Response(result)

    except Exception as e:
        log.exception("hybrid_chat_view error")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ----------- Unified AI Voice Command View -----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unified_ai_command_view(request):
    """
    Unified AI endpoint: STT → Search/Intent → NER → Action → TTS
    Single endpoint for complete voice command processing.

    Request:
    {
        "text": "What is Akmal's balance?",  # or from STT
        "conversation_id": "user_123_abc",  # optional
        "audio": "base64_encoded_audio"  # optional for STT
    }

    Response:
    {
        "status": "ok",
        "response": "Akmal's balance is 500,000 UZS",
        "action_type": "data_retrieval",
        "data": {"student_id": 123, "balance": 500000},
        "conversation_id": "user_123_abc",
        "language": "en"
    }
    """
    try:
        from .unified_ai_service import get_unified_ai

        text = request.data.get("text", "")
        conversation_id = request.data.get("conversation_id")
        audio_file = request.FILES.get("audio")

        if not text and not audio_file:
            return Response(
                {"detail": "text or audio required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # If audio provided, run STT first
        if audio_file and not text:
            # Save audio temp and run STT
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            try:
                raw_text, duration = transcribe_audio(tmp_path)
                text = spell_correct(raw_text)
            finally:
                try:
                    os.remove(tmp_path)
                except:
                    pass

        # Process with unified AI
        ai_service = get_unified_ai()
        result = ai_service.process_command(
            text=text,
            user=request.user,
            conversation_id=conversation_id,
            audio_file=audio_file
        )

        return Response(result)

    except Exception as e:
        log.exception("unified_ai_command_view error")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

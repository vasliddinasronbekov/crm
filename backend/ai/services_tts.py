# ai/services_tts.py
import os
import uuid
import tempfile
import requests
import logging
from django.conf import settings

log = logging.getLogger(__name__)

# ENV orqali microservice URL (misol: http://127.0.0.1:8001/tts)
TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", "http://127.0.0.1:8001/tts/form")
# vaqt kutishlar (sekundlarda)
REQUEST_TIMEOUT = float(os.getenv("TTS_REQ_TIMEOUT", "30"))
# Use local Piper TTS by default (set to False to use remote microservice)
USE_LOCAL_PIPER = os.getenv("USE_LOCAL_PIPER", "true").lower() in ("true", "1", "yes")


def text_to_speech_remote(text: str, speaker: str = None, language: str = None) -> str:
    """
    Microservice-ga POST qilib TTS oladi va vaqtincha wav faylga yozib,
    shu fayl yo'lini qaytaradi.
    """
    # paramlarni sozlash
    data = {"text": text}
    if speaker:
        data["speaker"] = speaker
    if language:
        data["language"] = language

    # POST form (multipart/form-data) — app.py hozir Form(...) qabul qiladi
    try:
        with requests.post(TTS_SERVICE_URL, data=data, stream=True, timeout=REQUEST_TIMEOUT) as r:
            r.raise_for_status()
            # temp fayl yaratish
            fd, tmp_path = tempfile.mkstemp(prefix="tts_", suffix=".wav")
            os.close(fd)
            # oqimni yozish
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return tmp_path
    except requests.RequestException as e:
        # log qilishingiz mumkin
        log.warning(f"TTS microservice request failed: {e}")
        raise RuntimeError(f"TTS microservice request failed: {e}") from e


def text_to_speech_simple_local(text: str, speaker: str = None, language: str = None) -> str:
    """
    Simple offline TTS using pyttsx3 (system voices).
    Works on any system without additional model downloads.
    """
    try:
        from ai.tts_simple_service import text_to_speech_simple
        return text_to_speech_simple(text, speaker=speaker, language=language)
    except Exception as e:
        log.exception(f"Simple TTS synthesis failed: {e}")
        raise


def text_to_speech_local_piper(text: str, speaker: str = None, language: str = None) -> str:
    """
    Local Piper TTS using CPU-optimized ONNX models.
    Fallback to simple TTS if Piper fails.
    """
    try:
        from ai.tts_piper_service import text_to_speech_piper_local
        return text_to_speech_piper_local(text, speaker=speaker, language=language)
    except Exception as e:
        log.warning(f"Piper TTS failed, falling back to simple TTS: {e}")
        # Fallback to simple TTS
        return text_to_speech_simple_local(text, speaker=speaker, language=language)


def text_to_speech_fallback_local(text: str, speaker: str = None, language: str = None) -> str:
    """
    Fallback to local Piper TTS if remote microservice fails.
    """
    return text_to_speech_local_piper(text, speaker=speaker, language=language)


def text_to_speech(text: str, speaker: str = None, language: str = None) -> str:
    """
    Main TTS function: uses local Piper TTS by default, can fallback to remote microservice.

    Priority:
    1. If USE_LOCAL_PIPER=true (default): Use local Piper TTS
    2. If USE_LOCAL_PIPER=false: Try remote microservice, fallback to local Piper

    Returns: wav file path
    """
    if USE_LOCAL_PIPER:
        # Use local Piper TTS directly
        try:
            return text_to_speech_local_piper(text, speaker=speaker, language=language)
        except Exception as e:
            log.error(f"Local Piper TTS failed: {e}")
            raise
    else:
        # Try remote microservice first, fallback to local
        try:
            return text_to_speech_remote(text, speaker=speaker, language=language)
        except Exception as e:
            log.warning(f"TTS remote failed, falling back to local Piper: {e}")
            return text_to_speech_fallback_local(text, speaker=speaker, language=language)

# ai/tts_piper_service.py
"""
Local Piper TTS service - CPU-optimized for 2-core, 8GB RAM
Uses piper-tts package with ONNX Runtime
Supports multiple languages with pre-downloaded models
"""
import os
import tempfile
import logging
from pathlib import Path
from typing import Optional
import wave
import numpy as np
import urllib.request
import json

log = logging.getLogger(__name__)

# Try to import piper
try:
    from piper import PiperVoice
    import onnxruntime as ort
    _HAS_PIPER = True
except ImportError as e:
    PiperVoice = None
    _HAS_PIPER = False
    log.warning(f"Piper TTS not available: {e}")

# Voice model configuration
PIPER_MODELS_DIR = Path(os.getenv("PIPER_MODELS_DIR", str(Path.home() / ".cache" / "piper_voices")))
PIPER_MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Piper voices repository base URL
PIPER_VOICES_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

# Default voice model URLs (x_low quality for fastest CPU inference)
DEFAULT_VOICE_MODELS = {
    "ru_RU-denis-medium": {
        "onnx": f"{PIPER_VOICES_BASE_URL}/ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx",
        "json": f"{PIPER_VOICES_BASE_URL}/ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx.json"
    },
    "en_US-lessac-medium": {
        "onnx": f"{PIPER_VOICES_BASE_URL}/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        "json": f"{PIPER_VOICES_BASE_URL}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
    }
}

# Global voice cache (avoid reloading models)
_voice_cache = {}


def download_voice_model(voice_key: str) -> tuple[Path, Path]:
    """
    Download Piper voice model from Hugging Face if not present.

    Args:
        voice_key: Voice identifier (e.g., "ru_RU-denis-medium")

    Returns:
        Tuple of (onnx_path, json_path)
    """
    if voice_key not in DEFAULT_VOICE_MODELS:
        raise ValueError(f"Unknown voice model: {voice_key}")

    model_dir = PIPER_MODELS_DIR / voice_key
    model_dir.mkdir(parents=True, exist_ok=True)

    onnx_path = model_dir / f"{voice_key}.onnx"
    json_path = model_dir / f"{voice_key}.onnx.json"

    # Download ONNX model
    if not onnx_path.exists():
        log.info(f"Downloading {voice_key} ONNX model...")
        urllib.request.urlretrieve(DEFAULT_VOICE_MODELS[voice_key]["onnx"], onnx_path)
        log.info(f"Downloaded: {onnx_path}")

    # Download config JSON
    if not json_path.exists():
        log.info(f"Downloading {voice_key} config...")
        urllib.request.urlretrieve(DEFAULT_VOICE_MODELS[voice_key]["json"], json_path)
        log.info(f"Downloaded: {json_path}")

    return onnx_path, json_path


def get_piper_voice(voice_key: str = "ru_RU-denis-medium") -> Optional['PiperVoice']:
    """
    Load or get cached Piper voice model.
    Auto-downloads model if not present.

    Args:
        voice_key: Voice identifier (e.g., "ru_RU-denis-medium")

    Returns:
        PiperVoice instance or None if loading fails
    """
    if not _HAS_PIPER:
        raise RuntimeError("piper-tts not installed. Run: pip install piper-tts")

    # Check cache
    if voice_key in _voice_cache:
        return _voice_cache[voice_key]

    try:
        # Ensure model is downloaded
        onnx_path, json_path = download_voice_model(voice_key)

        # Load voice
        voice = PiperVoice.load(str(onnx_path), config_path=str(json_path), use_cuda=False)

        # Cache the voice
        _voice_cache[voice_key] = voice
        log.info(f"Loaded Piper voice: {voice_key}")
        return voice

    except Exception as e:
        log.exception(f"Failed to load Piper voice {voice_key}: {e}")
        return None


def synthesize_piper(
    text: str,
    output_path: Optional[str] = None,
    voice_key: Optional[str] = None,
    language: str = "ru",
    speaker_id: Optional[int] = None
) -> str:
    """
    Synthesize speech using Piper TTS.

    Args:
        text: Text to synthesize
        output_path: Path to save WAV file (auto-generated if None)
        voice_key: Specific voice model key (uses default for language if None)
        language: Language code (uz, ru, en)
        speaker_id: Speaker ID for multi-speaker models

    Returns:
        Path to generated WAV file

    Raises:
        RuntimeError: If Piper is not available or synthesis fails
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    # Select voice (use Russian for Uzbek as no native model exists)
    if not voice_key:
        if language == "uz":
            voice_key = "ru_RU-denis-medium"  # Russian for Uzbek
        elif language == "en":
            voice_key = "en_US-lessac-medium"
        else:
            voice_key = "ru_RU-denis-medium"  # Default Russian

    # Load voice model
    voice = get_piper_voice(voice_key)
    if not voice:
        raise RuntimeError(f"Failed to load voice model: {voice_key}")

    # Generate output path if not provided
    if not output_path:
        fd, output_path = tempfile.mkstemp(prefix="piper_tts_", suffix=".wav")
        os.close(fd)

    try:
        # Synthesize speech using the new API
        with wave.open(output_path, 'wb') as wav_file:
            # Configure WAV file
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(voice.config.sample_rate)

            # Synthesize audio - voice.synthesize returns a generator of AudioChunk objects
            for audio_chunk in voice.synthesize(text):
                # AudioChunk has .audio_int16_bytes property containing bytes
                wav_file.writeframes(audio_chunk.audio_int16_bytes)

        log.info(f"Generated TTS audio: {output_path} ({len(text)} chars)")
        return output_path

    except Exception as e:
        log.exception(f"Piper synthesis failed: {e}")
        # Clean up failed file
        if output_path and os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception:
                pass
        raise RuntimeError(f"TTS synthesis failed: {e}")


def text_to_speech_piper_local(
    text: str,
    speaker: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Main TTS function compatible with existing services.py interface.

    Args:
        text: Text to synthesize
        speaker: Speaker name/ID (optional)
        language: Language code (uz, ru, en)

    Returns:
        Path to generated WAV file
    """
    lang = language or "uz"

    # Map speaker to voice_key if needed
    voice_key = None
    if speaker:
        # You can add speaker -> voice_key mapping here
        pass

    return synthesize_piper(
        text=text,
        voice_key=voice_key,
        language=lang,
        speaker_id=None
    )


# Pre-warm the default model (optional, can be enabled for production)
def prewarm_default_model():
    """
    Pre-load the default Russian voice model to reduce first-request latency.
    Call this during application startup.
    """
    try:
        log.info("Pre-warming default Piper TTS model...")
        voice = get_piper_voice("ru_RU-denis-medium")
        if voice:
            log.info("Default Piper model loaded successfully")
        else:
            log.warning("Failed to pre-warm Piper model")
    except Exception as e:
        log.warning(f"Failed to pre-warm model: {e}")


if __name__ == "__main__":
    # Test the TTS
    import sys

    test_text = "Salom, bu test audio hisoblanadi."
    if len(sys.argv) > 1:
        test_text = " ".join(sys.argv[1:])

    print(f"Synthesizing: {test_text}")
    try:
        output = text_to_speech_piper_local(test_text, language="uz")
        print(f"Generated audio: {output}")
        print(f"File size: {os.path.getsize(output)} bytes")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

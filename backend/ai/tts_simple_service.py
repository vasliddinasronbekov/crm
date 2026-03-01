# ai/tts_simple_service.py
"""
Simple offline TTS using pyttsx3 - Works on any CPU without GPU
Fallback TTS that works everywhere
"""
import os
import tempfile
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

try:
    import pyttsx3
    _HAS_PYTTSX3 = True
except ImportError:
    _HAS_PYTTSX3 = False
    log.warning("pyttsx3 not available")

# TTS engine cache
_engine = None


def get_tts_engine():
    """Get or create pyttsx3 engine"""
    global _engine
    if _engine is None and _HAS_PYTTSX3:
        _engine = pyttsx3.init()
        # Configure for better quality
        _engine.setProperty('rate', 150)  # Speed
        _engine.setProperty('volume', 0.9)  # Volume
    return _engine


def text_to_speech_simple(
    text: str,
    speaker: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Simple TTS using pyttsx3 (system voices)

    Args:
        text: Text to synthesize
        speaker: Unused (pyttsx3 uses system default voice)
        language: Language code (tries to select appropriate voice)

    Returns:
        Path to generated WAV file
    """
    if not _HAS_PYTTSX3:
        raise RuntimeError("pyttsx3 not installed. Run: pip install pyttsx3")

    engine = get_tts_engine()
    if not engine:
        raise RuntimeError("Failed to initialize TTS engine")

    # Generate temp file
    fd, output_path = tempfile.mkstemp(prefix="simple_tts_", suffix=".wav")
    os.close(fd)

    try:
        # Save to file
        engine.save_to_file(text, output_path)
        engine.runAndWait()

        log.info(f"Generated TTS audio (simple): {output_path}")
        return output_path

    except Exception as e:
        log.exception(f"Simple TTS failed: {e}")
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception:
                pass
        raise RuntimeError(f"TTS synthesis failed: {e}")


if __name__ == "__main__":
    import sys
    test_text = "Hello, this is a test."
    if len(sys.argv) > 1:
        test_text = " ".join(sys.argv[1:])

    print(f"Synthesizing: {test_text}")
    try:
        output = text_to_speech_simple(test_text)
        print(f"Generated audio: {output}")
        print(f"File size: {os.path.getsize(output)} bytes")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

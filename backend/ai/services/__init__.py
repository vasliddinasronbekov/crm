# AI Services

# Import from parent services.py file
import sys
from pathlib import Path

# Add parent directory to path to import from services.py
parent_dir = str(Path(__file__).parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Re-export functions from the services.py file in parent directory
try:
    from ..services import (
        transcribe_audio,
        extract_intent,
        extract_entities,
        spell_correct,
        get_whisper_model
    )
except ImportError:
    # Fallback: Define stub functions if import fails
    def transcribe_audio(*args, **kwargs):
        return "Transcription not available", 0

    def extract_intent(*args, **kwargs):
        return {}

    def extract_entities(*args, **kwargs):
        return []

    def spell_correct(text):
        return text

    def get_whisper_model():
        return None

__all__ = [
    'transcribe_audio',
    'extract_intent',
    'extract_entities',
    'spell_correct',
    'get_whisper_model'
]

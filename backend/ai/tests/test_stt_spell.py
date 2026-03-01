# ai/tests/test_stt_spell.py
import io, wave, numpy as np
from ai.services import spell_correct, transcribe_audio, get_whisper_model

def generate_sine(duration=1.0, rate=16000, freq=440.0):
    t = np.linspace(0, duration, int(rate*duration), False)
    sig = (0.5*np.sin(2*np.pi*freq*t)).astype(np.float32)
    arr = (sig * 32767).astype('int16')
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(arr.tobytes())
    buf.seek(0)
    return buf

def test_spell_fallback():
    s = "offlin esims funksiasi"
    corrected = spell_correct(s)
    assert isinstance(corrected, str)

# STT integration test is heavy — only run if faster_whisper installed
try:
    _ = get_whisper_model()
    HAS_STT = True
except Exception:
    HAS_STT = False

import pytest
@pytest.mark.skipif(not HAS_STT, reason="faster-whisper not available")
def test_transcribe_sine(tmp_path):
    buf = generate_sine()
    p = tmp_path / "t.wav"
    with p.open("wb") as f:
        f.write(buf.read())
    text, d = transcribe_audio(str(p))
    assert isinstance(text, str)


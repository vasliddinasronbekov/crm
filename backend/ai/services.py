# ai/services.py
"""
Advanced AI services for Edu API:
- STT (faster-whisper) with HF cache control
- Spell correction (hunspell preferred, fallback heuristics)
- Hybrid intent extraction (rule-based -> ML pipeline)
- Simple entity extraction (phone, amount, date)
- High-level process functions:
    - process_user_input(text, user)
    - process_audio_file(path, user)
Requirements (recommended):
  pip install faster-whisper huggingface_hub joblib scikit-learn hunspell
Note: all external deps are optional — module will degrade gracefully if missing.
"""
from __future__ import annotations
import os
import time
import logging
import re
from pathlib import Path
from typing import Tuple, Dict, Any, Optional

log = logging.getLogger(__name__)
# ai/services.py (qisqacha misol)
from ai import services_tts

def text_to_speech(text, speaker=None, language=None):
    """
    Backendning umumiy interface: wav fayl yo'lini qaytaradi.
    """
    return services_tts.text_to_speech(text=text, speaker=speaker, language=language)

# ----------------------------
# HuggingFace cache (optional)
# ----------------------------
# To override cache: export HF_HOME="/mnt/usb/huggingface_cache"
HF_CACHE_ENV = os.environ.get("HF_HOME") or os.environ.get("HUGGINGFACE_HUB_CACHE") or os.environ.get("HUGGINGFACE_CACHE")
if HF_CACHE_ENV:
    os.environ["HF_HOME"] = HF_CACHE_ENV
    os.environ["HUGGINGFACE_HUB_CACHE"] = HF_CACHE_ENV

# ----------------------------
# STT: faster-whisper (optional)
# ----------------------------
try:
    from faster_whisper import WhisperModel  # type: ignore
    _HAS_FW = True
except Exception as e:
    WhisperModel = None  # type: ignore
    _HAS_FW = False
    log.info("faster_whisper not available: %s", e)

_whisper_model = None

def get_whisper_model(size: str = "base", device: str = "cpu", compute_type: str = "int8"):
    """
    Load (or reuse) faster-whisper WhisperModel.
    Raises RuntimeError if faster-whisper not installed.

    CPU-Optimized defaults for 2-core, 8GB RAM:
    - size: "base" (lightweight, ~140MB model)
    - device: "cpu"
    - compute_type: "int8" (8-bit quantization for lower memory usage)
    """
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    if not _HAS_FW:
        raise RuntimeError("faster-whisper not installed. Install 'faster-whisper' to use local STT.")

    # CPU-optimized settings for low-resource systems
    log.info(f"Loading Whisper model: size={size}, device={device}, compute_type={compute_type}")

    # load (downloads if not present)
    _whisper_model = WhisperModel(
        size,
        device=device,
        compute_type=compute_type,
        cpu_threads=2,  # Use both CPU cores efficiently
        num_workers=1   # Single worker for lower memory usage
    )
    return _whisper_model

def transcribe_audio(path: str, language: str = "uz", model_size: str = "base", beam_size: int = 3, vad_filter: bool = True) -> Tuple[str, float]:
    """
    Transcribe audio file at `path` using faster-whisper.
    Returns (raw_text, duration_seconds).
    Raises FileNotFoundError or RuntimeError if model missing.

    CPU-Optimized defaults for 2-core, 8GB RAM:
    - model_size: "base" (lighter than "medium", ~140MB vs ~1.5GB)
    - beam_size: 3 (reduced from 5 for faster processing)
    - vad_filter: True (reduces processing of silence)
    """
    start = time.time()
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    if not _HAS_FW:
        raise RuntimeError("STT requested but faster-whisper not installed.")
    model = get_whisper_model(size=model_size)
    # faster-whisper returns (segments, info)
    segments, info = model.transcribe(
        str(path),
        beam_size=beam_size,
        vad_filter=vad_filter,
        language=language,
        condition_on_previous_text=False  # Reduces memory usage
    )
    # join segments with spaces and normalize whitespace
    text = " ".join(s.text.strip() for s in segments if getattr(s, "text", None))
    text = re.sub(r"\s+", " ", text).strip()
    duration = round(time.time() - start, 3)
    return text, duration

# ----------------------------
# Spell correction: hunspell preferred
# ----------------------------
try:
    import hunspell as _hunspell_py  # type: ignore
    _HAS_HUNSPELL = True
except Exception:
    _hunspell_py = None
    _HAS_HUNSPELL = False
    log.info("hunspell not available; fallback spell heuristics will be used")

_hun = None

def _init_hunspell(dict_dir: Optional[str] = None):
    """
    Initialize HunSpell with possible uzbek dictionaries.
    - dict_dir: directory where .aff/.dic files are located (system path by default)
    Returns hunspell object or None
    """
    global _hun
    if _hun is not None:
        return _hun
    if not _HAS_HUNSPELL:
        _hun = None
        return None
    # candidate names
    candidates = ["uz_UZ", "uz", "uz_latn"]
    if dict_dir:
        dd = Path(dict_dir)
        for c in candidates:
            aff = dd / f"{c}.aff"
            dic = dd / f"{c}.dic"
            if aff.exists() and dic.exists():
                try:
                    _hun = _hunspell_py.HunSpell(str(dic), str(aff))
                    return _hun
                except Exception:
                    continue
    # Try common system paths
    sys_paths = ["/usr/share/hunspell", "/usr/local/share/hunspell", "/usr/share/myspell"]
    for sp in sys_paths:
        dd = Path(sp)
        for c in candidates:
            aff = dd / f"{c}.aff"
            dic = dd / f"{c}.dic"
            if aff.exists() and dic.exists():
                try:
                    _hun = _hunspell_py.HunSpell(str(dic), str(aff))
                    return _hun
                except Exception:
                    continue
    # fallback to default constructor if available
    try:
        _hun = _hunspell_py.HunSpell()
        return _hun
    except Exception:
        _hun = None
        return None

# small mapping/fixes for common STT artifacts (extend as needed)
_SIMPLE_FIXES = {
    r"\bofflin\b": "offline",
    r"\bplay market\b": "Play Market",
    r"\bapp store\b": "App Store",
    # add more regex replacements if frequent
}

def spell_correct(text: str, dict_dir: Optional[str] = None) -> str:
    """
    Correct text using Hunspell if available, else run heuristic replacements.
    Token-based correction for hunspell (keeps punctuation).
    """
    text = (text or "").strip()
    if not text:
        return text
    # normalize whitespace
    text = re.sub(r"\s+", " ", text)
    # try Hunspell
    hun = _init_hunspell(dict_dir=dict_dir)
    if hun:
        tokens = re.findall(r"[\wʻʼʼʼ]+|[^\s\w]", text, flags=re.UNICODE)
        out = []
        for token in tokens:
            # keep punctuation
            if re.fullmatch(r"[^\wʻʼʼʼ]+", token):
                out.append(token)
                continue
            # if correct, keep; else try suggestion
            try:
                if hun.spell(token):
                    out.append(token)
                else:
                    sug = hun.suggest(token)
                    if sug:
                        out.append(sug[0])
                    else:
                        out.append(token)
            except Exception:
                out.append(token)
        return " ".join(out)
    # fallback simple fixes
    for pat, repl in _SIMPLE_FIXES.items():
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)
    # normalize spacing again
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ----------------------------
# Intent extraction: rule-based + sklearn ML
# ----------------------------
import joblib

INTENT_MODEL_PATH = Path(__file__).resolve().parent / "intent_model" / "pipeline.joblib"
_intent_pipe = None

def load_intent_pipeline():
    """
    Load sklearn pipeline from joblib; raise RuntimeError if missing.
    """
    global _intent_pipe
    if _intent_pipe is not None:
        return _intent_pipe
    if not INTENT_MODEL_PATH.exists():
        raise RuntimeError(f"Intent pipeline not found at {INTENT_MODEL_PATH}. Train model first.")
    _intent_pipe = joblib.load(INTENT_MODEL_PATH)
    return _intent_pipe

# keyword rules for voice-first CRM & LMS (extend this dictionary)
INTENT_KEYWORDS = {
    # Student/LMS queries
    "check_payment": ["to'lov", "tolov", "balans", "qarz", "pul", "tushdi", "tushmas", "to'lash", "pulim"],
    "schedule": ["jadval", "dars", "soat", "jadvali", "keyingi dars", "bugun dars", "ertaga", "darslar"],
    "enroll_course": ["yozili", "yozil", "kursga", "ro'yxat", "ro`yxat", "ro'yxatdan", "kurs", "o'qish"],
    "check_attendance": ["davomat", "davomad", "keldim", "kelmaganman", "qatnashdim"],
    "check_scores": ["natija", "ball", "test", "imtihon", "baho"],

    # CRM queries
    "list_leads": ["lidlar", "yangi lidlar", "lid", "mijozlar", "yangi kelganlar"],
    "lead_stats": ["lid statistika", "necha lid", "lid holati", "konversiya"],
    "add_lead": ["lid qo'sh", "yangi lid", "mijoz qo'sh", "ro'yxatga ol"],
    "student_count": ["necha o'quvchi", "talaba soni", "o'quvchilar", "jami talaba"],
    "today_payments": ["bugungi to'lov", "bugun to'lovlar", "bugun qancha", "kunlik to'lov"],

    # Communication
    "send_sms": ["sms yuborish", "xabar yuborish", "sms jo'natish"],

    # Greetings
    "greeting": ["salom", "assalomu", "hayrli kun", "assalomu alaykum", "zdravstvuyte", "hello"],
    "goodbye": ["xayr", "rahmat", "ko'rishamiz", "ko'rishamiz", "до свидания", "goodbye", "bye"],
}

def rule_based_intent(text: str, threshold: float = 0.0) -> Dict[str, Any]:
    """
    Simple keyword matcher returning best intent + relative confidence (0..1).
    """
    t = (text or "").lower()
    scores = {}
    for intent, kws in INTENT_KEYWORDS.items():
        for kw in kws:
            if kw in t:
                scores[intent] = scores.get(intent, 0) + 1
    if not scores:
        return {"intent": "unknown", "confidence": 0.0, "method": "rule"}
    best, cnt = max(scores.items(), key=lambda x: x[1])
    confidence = cnt / max(len(INTENT_KEYWORDS.get(best, [])), 1)
    return {"intent": best, "confidence": float(confidence), "method": "rule"}

def ml_intent(text: str) -> Dict[str, Any]:
    """
    Use sklearn pipeline to predict intent and probability.
    """
    pipe = load_intent_pipeline()
    pred = pipe.predict([text])[0]
    probs = pipe.predict_proba([text])[0]
    # find index of predicted class
    classes = list(pipe.classes_)
    try:
        idx = classes.index(pred)
    except ValueError:
        idx = 0
    return {"intent": str(pred), "confidence": float(probs[idx]), "method": "ml"}

def extract_intent(text: str, prefer_rule_threshold: float = 0.65) -> Dict[str, Any]:
    """
    Combined pipeline:
      1) run rule-based - if confident enough (>= prefer_rule_threshold) -> return
      2) else run ML -> if ML low and rule exists -> fallback to rule
    Returns dict: {intent, confidence, method}
    """
    rb = rule_based_intent(text)
    if rb["intent"] != "unknown" and rb["confidence"] >= prefer_rule_threshold:
        return rb
    # try ML
    try:
        ml = ml_intent(text)
    except Exception as e:
        log.warning("ML intent extraction failed: %s", e)
        return rb
    # fallback logic
    if ml["confidence"] < 0.35 and rb["intent"] != "unknown":
        return rb
    return ml

# ----------------------------
# Simple entity extraction
# ----------------------------
def extract_entities(text: str) -> Dict[str, str]:
    """
    Extract simple entities:
      - phone: +998XXXXXXXXX or 998XXXXXXXXX or 09XXXXXXXX
      - amount: numbers followed by 'so`m', 'so\'m', 'som', 'uzs'
      - date: simple dd.mm.yyyy or dd/mm or dd-mm or yyyy-mm-dd
    """
    ents: Dict[str, str] = {}
    t = text or ""
    # phone
    m = re.search(r"(\+998|998|0)\d{9}", t)
    if m:
        ents["phone"] = m.group(0)
    # amount (e.g., 100000 so'm or 100 000 som)
    m = re.search(r"(\d{1,3}(?:[ ,]\d{3})*|\d+)\s?(so'?m|som|uzs)?", t, flags=re.IGNORECASE)
    if m:
        val = m.group(0).strip()
        # avoid capturing dates as amounts (heurstic: if contains / or - likely a date)
        if not re.search(r"[./-]", val):
            ents["amount"] = val
    # date
    m = re.search(r"\b(\d{1,4}[./-]\d{1,2}[./-]\d{1,4})\b", t)
    if m:
        ents["date"] = m.group(1)
    return ents

# ----------------------------
# High-level orchestration
# ----------------------------
# Intent handler import is deferred to avoid circular imports at module import time.
def _get_intent_handler():
    try:
        # local import to prevent circularity
        from . import intent_handler  # type: ignore
        return intent_handler
    except Exception as e:
        log.warning("Could not import intent_handler: %s", e)
        return None

INTENT_CONFIDENCE_THRESHOLD = float(os.environ.get("INTENT_CONFIDENCE_THRESHOLD", 0.35))

def process_user_input(text: str, user: Optional[Any] = None, spell_dict_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Process text: spell-correct -> extract_intent -> extract_entities -> dispatch to intent handler
    Returns result dict from handler or clarification suggestion.
    """
    text = (text or "").strip()
    if not text:
        return {"status": "error", "response": "Text empty"}

    # 1) spell-correct (best effort)
    corrected = spell_correct(text, dict_dir=spell_dict_dir)
    # 2) intent extraction (hybrid)
    try:
        nlu = extract_intent(corrected)
    except Exception as e:
        log.exception("extract_intent failed: %s", e)
        nlu = {"intent": "unknown", "confidence": 0.0, "method": "error"}

    # 3) entities
    ents = extract_entities(corrected)

    # 4) confidence check
    if nlu.get("confidence", 0.0) < INTENT_CONFIDENCE_THRESHOLD:
        # return clarification request; include possible entities and corrected text
        return {
            "status": "clarify",
            "question": "Nimani nazarda tutyapsiz? (to'lov/jadval/yozilish)",
            "corrected": corrected,
            "entities": ents,
            "nlu": nlu
        }

    # 5) dispatch to intent handler
    handler = _get_intent_handler()
    if not handler:
        return {"status": "error", "response": "Intent handler not available", "nlu": nlu, "entities": ents}

    try:
        result = handler.handle_nlu_result_sync(nlu, transcript=corrected, user=user, entities=ents)
    except TypeError:
        # If handler signature doesn't accept entities param, call without it
        try:
            result = handler.handle_nlu_result_sync(nlu, transcript=corrected, user=user)
        except Exception as e:
            log.exception("intent handler failed: %s", e)
            result = {"status": "error", "response": str(e)}
    except Exception as e:
        log.exception("intent handler exception: %s", e)
        result = {"status": "error", "response": str(e)}

    # unify response
    out = {"status": "ok", "nlu": nlu, "entities": ents, "result": result} if result else {"status": "error", "response": "Empty handler result"}
    return out

def process_audio_file(path: str, user: Optional[Any] = None, language: str = "uz", model_size: str = "medium", spell_dict_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Full audio -> text -> intent pipeline:
      - transcribe_audio
      - spell_correct
      - extract_intent + entities
      - intent_handler dispatch
    Returns dict containing raw, corrected, duration, and handler result.
    """
    try:
        raw, duration = transcribe_audio(path, language=language, model_size=model_size)
    except FileNotFoundError:
        return {"status": "error", "response": f"Audio file not found: {path}"}
    except RuntimeError as e:
        log.exception("STT error: %s", e)
        return {"status": "error", "response": f"STT error: {e}"}
    except Exception as e:
        log.exception("Unexpected STT error: %s", e)
        return {"status": "error", "response": f"Unexpected STT error: {e}"}

    corrected = spell_correct(raw, dict_dir=spell_dict_dir)
    # reuse process_user_input internals by calling extract_intent etc.
    nlu = extract_intent(corrected)
    ents = extract_entities(corrected)
    # confidence check
    if nlu.get("confidence", 0.0) < INTENT_CONFIDENCE_THRESHOLD:
        return {
            "status": "clarify",
            "raw": raw,
            "corrected": corrected,
            "duration": duration,
            "nlu": nlu,
            "entities": ents,
            "question": "Nimani nazarda tutyapsiz? (to'lov/jadval/yozilish)"
        }
    # dispatch
    handler = _get_intent_handler()
    if not handler:
        return {"status": "error", "response": "Intent handler not available", "raw": raw, "corrected": corrected, "duration": duration}
    try:
        result = handler.handle_nlu_result_sync(nlu, transcript=corrected, user=user, entities=ents)
    except TypeError:
        result = handler.handle_nlu_result_sync(nlu, transcript=corrected, user=user)
    except Exception as e:
        log.exception("intent handler error: %s", e)
        result = {"status": "error", "response": str(e)}

    return {
        "status": "ok",
        "raw": raw,
        "corrected": corrected,
        "duration": duration,
        "nlu": nlu,
        "entities": ents,
        "result": result
    }

# ----------------------------
# CLI helper (optional)
# ----------------------------
if __name__ == "__main__":  # quick local debug runner
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("--audio", help="Path to audio file")
    p.add_argument("--text", help="Text to process")
    p.add_argument("--model-size", default="medium")
    p.add_argument("--hf-cache", default=None, help="Set HF cache directory for this run")
    args = p.parse_args()
    if args.hf_cache:
        os.environ["HF_HOME"] = args.hf_cache
        os.environ["HUGGINGFACE_HUB_CACHE"] = args.hf_cache
    if args.audio:
        out = process_audio_file(args.audio, model_size=args.model_size)
        print(json.dumps(out, ensure_ascii=False, indent=2))
    elif args.text:
        out = process_user_input(args.text)
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        p.print_help()

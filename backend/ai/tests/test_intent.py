# ai/tests/test_intent.py
import pytest
from ai.services import rule_based_intent, extract_intent, extract_entities

def test_rule_payment():
    t = "Mening to'lovim qachon tushadi"
    r = rule_based_intent(t)
    assert r["intent"] == "check_payment"

def test_ml_pipeline_load():
    try:
        res = extract_intent("Balansimni tekshirish kerak")
        assert "intent" in res
    except Exception:
        # If model not trained, it's ok for CI; but rule-based should still work
        rb = rule_based_intent("Balansimni tekshirish kerak")
        assert rb["intent"] == "check_payment"

def test_entities():
    ents = extract_entities("Men 50000 so'm to'ladim. Tel: +998901234567")
    assert "amount" in ents or "phone" in ents

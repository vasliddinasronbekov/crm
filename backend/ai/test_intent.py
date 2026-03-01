# ai/tests/test_intent.py
import pytest
from ai.services import rule_based_intent, extract_entities


def test_rule_based_payment():
    text = "Mening to'lovim qachon tushadi?"
    res = rule_based_intent(text)
    assert res["intent"] == "check_payment"


def test_extract_amount():
    text = "Men 50000 so'm to'ladim"
    ents = extract_entities(text)
    assert "amount" in ents

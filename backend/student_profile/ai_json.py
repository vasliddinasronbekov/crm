"""
Helpers for parsing LLM JSON responses defensively.
"""

from __future__ import annotations

import json


def parse_llm_json(raw_response, default):
    if not raw_response:
        return default

    response = str(raw_response).strip()
    if response.startswith("```"):
        response = response.strip("`")
        if response.lower().startswith("json"):
            response = response[4:].strip()

    start = response.find("{")
    end = response.rfind("}")
    if start != -1 and end != -1 and end > start:
        response = response[start:end + 1]

    try:
        return json.loads(response)
    except Exception:
        return default

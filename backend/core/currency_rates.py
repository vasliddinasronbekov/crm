from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict

import requests
from django.core.cache import cache

SUPPORTED_CURRENCIES = ("UZS", "USD", "RUB", "EUR")
BASE_CURRENCY = "UZS"

# Conservative fallback rates (from UZS) used only when provider is unavailable.
FALLBACK_RATES_FROM_BASE: Dict[str, Decimal] = {
    "UZS": Decimal("1"),
    "USD": Decimal("0.0000793651"),  # ~1 / 12600
    "EUR": Decimal("0.0000729927"),  # ~1 / 13700
    "RUB": Decimal("0.0071428571"),  # ~1 / 140
}

CACHE_KEY = "core:currency_rates:v1"
CACHE_TTL_SECONDS = 30 * 60
PROVIDER_TIMEOUT_SECONDS = 5
PROVIDER_URL = "https://open.er-api.com/v6/latest/UZS"


@dataclass
class CurrencyRatesSnapshot:
    base_currency: str
    supported_currencies: list[str]
    rates_from_base: Dict[str, float]
    source: str
    fetched_at: str
    expires_in_seconds: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "base_currency": self.base_currency,
            "supported_currencies": self.supported_currencies,
            "rates_from_base": self.rates_from_base,
            "source": self.source,
            "fetched_at": self.fetched_at,
            "expires_in_seconds": self.expires_in_seconds,
        }


def _to_decimal(value: Any) -> Decimal | None:
    try:
        decimal = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if decimal <= 0:
        return None
    return decimal


def _normalize_rates_from_provider(base: str, raw_rates: Dict[str, Any]) -> Dict[str, Decimal] | None:
    base = (base or "").upper().strip()

    decimal_rates: Dict[str, Decimal] = {}
    for code in SUPPORTED_CURRENCIES:
        if code not in raw_rates:
            continue
        decimal = _to_decimal(raw_rates[code])
        if decimal is not None:
            decimal_rates[code] = decimal

    if base == BASE_CURRENCY:
        normalized = {code: decimal_rates.get(code) for code in SUPPORTED_CURRENCIES}
    else:
        base_to_uzs = decimal_rates.get(BASE_CURRENCY)
        if base_to_uzs is None:
            return None
        normalized = {}
        for code in SUPPORTED_CURRENCIES:
            if code == BASE_CURRENCY:
                normalized[code] = Decimal("1")
                continue
            base_to_target = decimal_rates.get(code)
            if base_to_target is None:
                continue
            normalized[code] = base_to_target / base_to_uzs

    normalized[BASE_CURRENCY] = Decimal("1")

    if any(code not in normalized or normalized[code] is None for code in SUPPORTED_CURRENCIES):
        return None

    return normalized  # type: ignore[return-value]


def _fetch_provider_rates() -> Dict[str, Decimal] | None:
    response = requests.get(PROVIDER_URL, timeout=PROVIDER_TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()

    base = str(payload.get("base_code") or payload.get("base") or "")
    raw_rates = payload.get("rates")
    if not isinstance(raw_rates, dict):
        return None

    return _normalize_rates_from_provider(base, raw_rates)


def _build_snapshot(rates_from_base: Dict[str, Decimal], source: str) -> CurrencyRatesSnapshot:
    now = datetime.now(timezone.utc)
    return CurrencyRatesSnapshot(
        base_currency=BASE_CURRENCY,
        supported_currencies=list(SUPPORTED_CURRENCIES),
        rates_from_base={code: float(rates_from_base[code]) for code in SUPPORTED_CURRENCIES},
        source=source,
        fetched_at=now.isoformat(),
        expires_in_seconds=CACHE_TTL_SECONDS,
    )


def _load_cached_snapshot() -> Dict[str, Any] | None:
    cached = cache.get(CACHE_KEY)
    return cached if isinstance(cached, dict) else None


def get_currency_rates_snapshot(force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh:
        cached = _load_cached_snapshot()
        if cached:
            return cached

    try:
        live_rates = _fetch_provider_rates()
        if live_rates:
            snapshot = _build_snapshot(live_rates, source="open-er-api")
            payload = snapshot.to_dict()
            cache.set(CACHE_KEY, payload, CACHE_TTL_SECONDS)
            return payload
    except Exception:
        cached = _load_cached_snapshot()
        if cached:
            stale_copy = dict(cached)
            stale_copy["source"] = "cache-fallback"
            return stale_copy

    fallback_snapshot = _build_snapshot(FALLBACK_RATES_FROM_BASE, source="fallback-static")
    payload = fallback_snapshot.to_dict()
    cache.set(CACHE_KEY, payload, min(CACHE_TTL_SECONDS, 5 * 60))
    return payload

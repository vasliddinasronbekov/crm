from __future__ import annotations

import base64
import json
from typing import Any

import requests
from decouple import config
from django.utils import timezone

from .models import Payment, PaymentType


REMOTE_SYNC_METHOD_CODES = {'payme', 'click'}
CASH_METHOD_CODES = {'cash'}


PAYMENT_METHOD_NAME_ALIASES = {
    'cash': {'cash', 'naqd', 'наличные', 'нал'},
    'payme': {'payme', 'pay me'},
    'click': {'click'},
}

PROVIDER_STATUS_TO_LOCAL_STATUS = {
    'paid': Payment.PaymentStatus.PAID,
    'pending': Payment.PaymentStatus.PENDING,
    'failed': Payment.PaymentStatus.FAILED,
}


def _normalize_text(value: str | None) -> str:
    return (value or '').strip().lower()


def resolve_payment_method_code(payment_type: PaymentType | None) -> str:
    if not payment_type:
        return ''

    code = _normalize_text(getattr(payment_type, 'code', None))
    if code:
        return code

    name = _normalize_text(getattr(payment_type, 'name', None))
    for canonical_code, aliases in PAYMENT_METHOD_NAME_ALIASES.items():
        if name in aliases:
            return canonical_code
    return name


def detect_reconciliation_issues(
    payment: Payment,
    *,
    duplicate_transaction_ids: set[str] | None = None,
    stale_pending_days: int = 2,
    now_dt=None,
) -> list[str]:
    issues: list[str] = []
    method_code = resolve_payment_method_code(payment.payment_type)
    transaction_id = (payment.transaction_id or '').strip()
    status = payment.status
    now_value = now_dt or timezone.now()
    age_days = max(0, (now_value.date() - payment.date).days) if payment.date else 0

    if method_code in REMOTE_SYNC_METHOD_CODES:
        if status == Payment.PaymentStatus.PAID and not transaction_id:
            issues.append('remote_paid_without_transaction_id')
        if status == Payment.PaymentStatus.PENDING and age_days >= stale_pending_days:
            issues.append('remote_pending_stale')
        if status == Payment.PaymentStatus.FAILED and age_days <= 3:
            issues.append('remote_failed_recent_retry_candidate')

    if method_code in CASH_METHOD_CODES:
        if status == Payment.PaymentStatus.PAID and not hasattr(payment, 'cash_receipt'):
            issues.append('cash_paid_without_receipt')
    else:
        if hasattr(payment, 'cash_receipt'):
            issues.append('non_cash_has_cash_receipt')

    if transaction_id and duplicate_transaction_ids and transaction_id in duplicate_transaction_ids:
        issues.append('duplicate_transaction_id')

    return issues


def _extract_candidate_state_values(payload: Any) -> list[str]:
    values: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                key_lower = str(key).lower()
                if key_lower in {'status', 'state', 'payment_status', 'transaction_status'}:
                    values.append(_normalize_text(str(value)))
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return values


def _map_provider_state_to_local_status(candidate_states: list[str]) -> str:
    failed_tokens = {'failed', 'cancelled', 'canceled', 'error', 'rejected', '-1', '-2', '4'}
    paid_tokens = {'paid', 'success', 'succeeded', 'completed', 'done', '2'}
    pending_tokens = {'pending', 'processing', 'created', 'new', 'in_progress', '0', '1'}

    for state in candidate_states:
        if state in failed_tokens:
            return 'failed'
    for state in candidate_states:
        if state in paid_tokens:
            return 'paid'
    for state in candidate_states:
        if state in pending_tokens:
            return 'pending'
    return 'unknown'


def _sync_payme(payment: Payment) -> dict[str, Any]:
    merchant_id = config('PAYME_MERCHANT_ID', default='')
    secret_key = config('PAYME_SECRET_KEY', default='')
    payme_url = config('PAYME_CHECK_URL', default='https://checkout.paycom.uz/api')
    transaction_id = (payment.transaction_id or '').strip()

    if not merchant_id or not secret_key:
        return {
            'provider': 'payme',
            'syncable': False,
            'provider_status': 'unknown',
            'reason': 'payme_credentials_missing',
        }

    if not transaction_id:
        return {
            'provider': 'payme',
            'syncable': False,
            'provider_status': 'unknown',
            'reason': 'missing_transaction_id',
        }

    auth_string = f'ac.{merchant_id}={secret_key}'
    encoded_auth = base64.b64encode(auth_string.encode()).decode()
    headers = {'X-Auth': encoded_auth, 'Content-Type': 'application/json'}
    payload = {'method': 'receipts.check', 'params': {'id': transaction_id}}

    response = requests.post(payme_url, headers=headers, data=json.dumps(payload), timeout=15)
    response.raise_for_status()
    response_json = response.json()

    candidate_states = _extract_candidate_state_values(response_json)
    provider_status = _map_provider_state_to_local_status(candidate_states)
    if response_json.get('error') and provider_status == 'unknown':
        provider_status = 'failed'

    return {
        'provider': 'payme',
        'syncable': True,
        'provider_status': provider_status,
        'reason': '' if provider_status != 'unknown' else 'unrecognized_provider_state',
        'provider_reference': transaction_id,
        'raw': response_json,
    }


def _sync_click(payment: Payment) -> dict[str, Any]:
    status_url = config('CLICK_STATUS_URL', default='')
    click_service_id = config('CLICK_SERVICE_ID', default='')
    click_merchant_id = config('CLICK_MERCHANT_ID', default='')
    click_merchant_user_id = config('CLICK_MERCHANT_USER_ID', default='')
    click_secret_key = config('CLICK_SECRET_KEY', default='')
    transaction_id = (payment.transaction_id or '').strip()

    if not status_url:
        return {
            'provider': 'click',
            'syncable': False,
            'provider_status': 'unknown',
            'reason': 'click_status_url_missing',
        }

    if not transaction_id:
        return {
            'provider': 'click',
            'syncable': False,
            'provider_status': 'unknown',
            'reason': 'missing_transaction_id',
        }

    headers = {'Content-Type': 'application/json'}
    if click_merchant_user_id and click_secret_key:
        auth_raw = f'{click_merchant_user_id}:{click_secret_key}'.encode()
        headers['Authorization'] = f"Basic {base64.b64encode(auth_raw).decode()}"

    payload = {
        'service_id': click_service_id,
        'merchant_id': click_merchant_id,
        'transaction_id': transaction_id,
    }
    response = requests.post(status_url, headers=headers, json=payload, timeout=15)
    response.raise_for_status()
    response_json = response.json()

    candidate_states = _extract_candidate_state_values(response_json)
    provider_status = _map_provider_state_to_local_status(candidate_states)

    # Click-like APIs usually return non-zero error code for failed transactions.
    error_code = response_json.get('error_code') or response_json.get('error')
    if error_code not in (None, 0, '0') and provider_status == 'unknown':
        provider_status = 'failed'

    return {
        'provider': 'click',
        'syncable': True,
        'provider_status': provider_status,
        'reason': '' if provider_status != 'unknown' else 'unrecognized_provider_state',
        'provider_reference': transaction_id,
        'raw': response_json,
    }


def sync_payment_with_provider(payment: Payment) -> dict[str, Any]:
    method_code = resolve_payment_method_code(payment.payment_type)
    if method_code == 'payme':
        return _sync_payme(payment)
    if method_code == 'click':
        return _sync_click(payment)
    return {
        'provider': method_code or 'unknown',
        'syncable': False,
        'provider_status': 'unknown',
        'reason': 'provider_sync_not_supported',
    }

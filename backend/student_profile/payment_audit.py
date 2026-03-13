from __future__ import annotations

from typing import Any

from .models import Payment, PaymentAuditLog


def build_payment_snapshot(payment: Payment | None) -> dict[str, Any]:
    if payment is None:
        return {}

    return {
        'id': payment.id,
        'date': payment.date.isoformat() if payment.date else '',
        'by_user_id': payment.by_user_id,
        'group_id': payment.group_id,
        'teacher_id': payment.teacher_id,
        'status': payment.status,
        'amount': int(payment.amount or 0),
        'course_price': int(payment.course_price or 0),
        'payment_type_id': payment.payment_type_id,
        'detail': payment.detail or '',
        'transaction_id': payment.transaction_id or '',
    }


def _extract_ip_address(request) -> str:
    if request is None:
        return ''
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip()


def _resolve_actor_display(actor) -> str:
    if not actor:
        return 'System'
    full_name = actor.get_full_name().strip()
    if full_name:
        return full_name
    if getattr(actor, 'username', None):
        return actor.username
    return f'User#{actor.id}'


def _compute_changed_fields(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    keys = sorted(set(before.keys()) | set(after.keys()))
    return [key for key in keys if before.get(key) != after.get(key)]


def create_payment_audit_log(
    *,
    payment: Payment | None,
    event_type: str,
    actor=None,
    request=None,
    previous_snapshot: dict[str, Any] | None = None,
    new_snapshot: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> PaymentAuditLog:
    before_snapshot = previous_snapshot or {}
    after_snapshot = new_snapshot if new_snapshot is not None else build_payment_snapshot(payment)
    changed_fields = _compute_changed_fields(before_snapshot, after_snapshot)

    payment_id_snapshot = 0
    transaction_id_snapshot = ''
    if payment is not None:
        payment_id_snapshot = payment.id
        transaction_id_snapshot = payment.transaction_id or ''
    elif before_snapshot:
        payment_id_snapshot = int(before_snapshot.get('id') or 0)
        transaction_id_snapshot = str(before_snapshot.get('transaction_id') or '')

    return PaymentAuditLog.objects.create(
        payment=payment,
        payment_id_snapshot=payment_id_snapshot,
        transaction_id_snapshot=transaction_id_snapshot,
        event_type=event_type,
        changed_by_user=actor if getattr(actor, 'is_authenticated', False) else None,
        changed_by_display=_resolve_actor_display(actor),
        amount_before=before_snapshot.get('amount'),
        amount_after=after_snapshot.get('amount'),
        course_price_before=before_snapshot.get('course_price'),
        course_price_after=after_snapshot.get('course_price'),
        status_before=before_snapshot.get('status', ''),
        status_after=after_snapshot.get('status', ''),
        changed_fields=changed_fields,
        previous_snapshot=before_snapshot,
        new_snapshot=after_snapshot,
        metadata=metadata or {},
        source='api' if request is not None else 'system',
        request_method=getattr(request, 'method', '') or '',
        request_path=getattr(request, 'path', '') or '',
        ip_address=_extract_ip_address(request),
        user_agent=(request.META.get('HTTP_USER_AGENT', '') if request is not None else ''),
    )

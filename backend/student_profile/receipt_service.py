import base64
import io
import json
import secrets
from typing import Any

import qrcode
from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from .models import CashPaymentReceipt, Payment


CASH_PAYMENT_METHOD_NAMES = {
    'cash',
    'naqd',
    'наличные',
    'нал',
}


def _normalize_payment_method_name(name: str | None) -> str:
    return (name or '').strip().lower()


def is_cash_payment(payment: Payment) -> bool:
    payment_type_name = _normalize_payment_method_name(getattr(payment.payment_type, 'name', None))
    return payment_type_name in CASH_PAYMENT_METHOD_NAMES


def _resolve_user_full_name(user) -> str:
    if not user:
        return ''
    full_name = user.get_full_name().strip()
    return full_name or user.username


def _resolve_education_center_name() -> str:
    return getattr(settings, 'EDUCATION_CENTER_NAME', 'EduVoice Education Center')


def _generate_receipt_number() -> str:
    today_prefix = timezone.localtime().strftime('RC-%Y%m%d')
    for _ in range(1000):
        existing_count = CashPaymentReceipt.objects.filter(
            receipt_number__startswith=today_prefix
        ).count()
        candidate = f"{today_prefix}-{existing_count + 1:05d}"
        if not CashPaymentReceipt.objects.filter(receipt_number=candidate).exists():
            return candidate
    # Fallback with random suffix in extreme collision cases.
    return f"{today_prefix}-{secrets.token_hex(3).upper()}"


def _generate_receipt_token() -> str:
    while True:
        token = secrets.token_urlsafe(18)
        if not CashPaymentReceipt.objects.filter(receipt_token=token).exists():
            return token


def _calculate_remaining_balance(payment: Payment) -> int:
    course_price = int(payment.course_price or 0)
    if payment.group_id and payment.group and payment.group.course_id and payment.group.course:
        course_price = int(payment.group.course.price or course_price)

    if course_price <= 0 or not payment.by_user_id:
        return 0

    paid_queryset = Payment.objects.filter(
        by_user_id=payment.by_user_id,
        status=Payment.PaymentStatus.PAID,
    )
    if payment.group_id:
        paid_queryset = paid_queryset.filter(group_id=payment.group_id)

    paid_total = int(paid_queryset.aggregate(total=Sum('amount')).get('total') or 0)
    return max(course_price - paid_total, 0)


def ensure_cash_receipt(payment: Payment, actor=None) -> CashPaymentReceipt | None:
    """
    Generate (once) and return a cash receipt snapshot for a payment.
    Returns None for non-cash payments.
    """
    if not is_cash_payment(payment):
        return None

    existing = getattr(payment, 'cash_receipt', None)
    if existing:
        return existing

    receipt = CashPaymentReceipt.objects.create(
        payment=payment,
        receipt_number=_generate_receipt_number(),
        receipt_token=_generate_receipt_token(),
        education_center_name=_resolve_education_center_name(),
        branch_name=(payment.group.branch.name if payment.group and payment.group.branch else ''),
        cashier_full_name=_resolve_user_full_name(actor),
        student_full_name=_resolve_user_full_name(payment.by_user),
        group_name=(payment.group.name if payment.group else ''),
        course_service_name=(
            payment.group.course.name
            if payment.group and payment.group.course_id and payment.group.course
            else ''
        ),
        payment_method='cash',
        paid_amount=int(payment.amount or 0),
        remaining_balance=_calculate_remaining_balance(payment),
        note=(payment.detail or '').strip(),
        metadata={
            'payment_status': payment.status,
            'payment_type': getattr(payment.payment_type, 'name', None),
            'payment_id': payment.id,
        },
    )
    return receipt


def _generate_qr_data_url(qr_data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    image = qr.make_image(fill_color='black', back_color='white')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def build_cash_receipt_payload(receipt: CashPaymentReceipt, request=None) -> dict[str, Any]:
    payment = receipt.payment
    issued_at_local = timezone.localtime(receipt.issued_at)
    verification_path = f"/api/v1/payment/{payment.id}/cash-receipt-by-token/{receipt.receipt_token}/"
    verification_url = (
        request.build_absolute_uri(verification_path) if request else verification_path
    )

    qr_payload = {
        'type': 'cash_payment_receipt',
        'receipt_number': receipt.receipt_number,
        'receipt_token': receipt.receipt_token,
        'payment_id': payment.id,
        'amount_minor': receipt.paid_amount,
        'issued_at': receipt.issued_at.isoformat(),
    }
    qr_content = verification_url

    return {
        'id': receipt.id,
        'payment_id': payment.id,
        'transaction_id': payment.transaction_id or receipt.receipt_number,
        'receipt_number': receipt.receipt_number,
        'receipt_token': receipt.receipt_token,
        'issued_at': receipt.issued_at.isoformat(),
        'issued_at_display': issued_at_local.strftime('%Y-%m-%d %H:%M'),
        'education_center_name': receipt.education_center_name,
        'branch': receipt.branch_name,
        'cashier_full_name': receipt.cashier_full_name,
        'student_full_name': receipt.student_full_name,
        'group_name': receipt.group_name,
        'course_service_name': receipt.course_service_name,
        'payment_method': receipt.payment_method,
        'paid_amount': receipt.paid_amount,
        'remaining_balance': receipt.remaining_balance,
        'note': receipt.note,
        'verification_url': verification_url,
        'qr_payload': qr_payload,
        'qr_payload_json': json.dumps(qr_payload, separators=(',', ':')),
        'qr_code_image': _generate_qr_data_url(qr_content),
    }


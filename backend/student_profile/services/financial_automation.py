from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Optional, Tuple

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from users.models import User

from student_profile.accounting_models import (
    AccountTransaction,
    AccountingActivityLog,
    CompanyShareEntry,
    MonthlySubscriptionCharge,
    AttendanceCharge,
    StudentBalance,
    StudentAccount,
    TeacherEarnings,
)
from student_profile.models import Attendance, Group, Payment

logger = logging.getLogger(__name__)

WEEKDAY_MAP = {
    'mon': 0,
    'monday': 0,
    'du': 0,
    'tue': 1,
    'tues': 1,
    'tuesday': 1,
    'se': 1,
    'wed': 2,
    'wednesday': 2,
    'cho': 2,
    'thu': 3,
    'thurs': 3,
    'thursday': 3,
    'pay': 3,
    'fri': 4,
    'friday': 4,
    'ju': 4,
    'sat': 5,
    'saturday': 5,
    'shan': 5,
    'sun': 6,
    'sunday': 6,
    'yak': 6,
}
DEFAULT_MONTHLY_SESSIONS = 12
TEACHER_SHARE_PERCENT = 40


def _round_tiyin(value: Decimal) -> int:
    return int(value.quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _normalize_days(days_text: str) -> set[int]:
    if not days_text:
        return set()
    weekdays: set[int] = set()
    for raw_token in days_text.replace('/', ',').replace('-', ',').split(','):
        token = raw_token.strip().lower()
        if not token:
            continue
        if token.isdigit():
            index = int(token)
            if 0 <= index <= 6:
                weekdays.add(index)
            continue
        mapped = WEEKDAY_MAP.get(token)
        if mapped is not None:
            weekdays.add(mapped)
    return weekdays


def estimate_group_class_days(group: Group, year: int, month: int) -> int:
    weekdays = _normalize_days(group.days or '')
    if not weekdays:
        return DEFAULT_MONTHLY_SESSIONS
    _, last_day = monthrange(year, month)
    days_count = 0
    for day in range(1, last_day + 1):
        if date(year, month, day).weekday() in weekdays:
            days_count += 1
    return days_count if days_count > 0 else DEFAULT_MONTHLY_SESSIONS


def resolve_group_lesson_denominator(group: Group, target_date: date) -> int:
    """
    Resolve lesson denominator according to group billing mode.
    - fixed_planned: use planned_monthly_lessons
    - actual_monthly: use real calendar lesson count for the month
    """
    mode = getattr(group, 'billing_mode', Group.BILLING_MODE_FIXED_PLANNED)
    if mode == Group.BILLING_MODE_ACTUAL_MONTHLY:
        return max(estimate_group_class_days(group, target_date.year, target_date.month), 1)
    return max(int(getattr(group, 'planned_monthly_lessons', DEFAULT_MONTHLY_SESSIONS) or DEFAULT_MONTHLY_SESSIONS), 1)


def calculate_per_lesson_fee_tiyin(group: Group, target_date: date) -> tuple[int, int, int]:
    """
    Returns: (course_price_tiyin, denominator, per_lesson_fee_tiyin)
    """
    course_price_tiyin = int(getattr(group.course, 'price', 0) or 0)
    denominator = resolve_group_lesson_denominator(group, target_date)
    per_lesson_fee_tiyin = _round_tiyin(
        Decimal(course_price_tiyin) / Decimal(max(denominator, 1))
    )
    return course_price_tiyin, denominator, per_lesson_fee_tiyin


def split_lesson_fee_tiyin(per_lesson_fee_tiyin: int, teacher_share_percent: int = TEACHER_SHARE_PERCENT) -> tuple[int, int]:
    normalized_percent = max(0, min(int(teacher_share_percent), 100))
    teacher_amount_tiyin = _round_tiyin(
        Decimal(per_lesson_fee_tiyin) * Decimal(normalized_percent) / Decimal(100)
    )
    company_amount_tiyin = int(per_lesson_fee_tiyin) - int(teacher_amount_tiyin)
    return int(teacher_amount_tiyin), int(company_amount_tiyin)


def get_or_create_student_account(student: User) -> StudentAccount:
    account, _ = StudentAccount.objects.get_or_create(student=student)
    return account


def _broadcast_activity_log(log: AccountingActivityLog) -> None:
    try:
        channel_layer = get_channel_layer()
    except Exception as exc:
        logger.debug("Accounting websocket layer unavailable: %s", exc)
        return
    if not channel_layer:
        return

    payload = {
        'id': log.id,
        'action_type': log.action_type,
        'actor': log.actor_id,
        'actor_username': log.actor.username if log.actor else None,
        'student': log.student_id,
        'student_username': log.student.username if log.student else None,
        'group': log.group_id,
        'group_name': log.group.name if log.group else None,
        'message': log.message,
        'amount_tiyin': log.amount_tiyin,
        'balance_after_tiyin': log.balance_after_tiyin,
        'metadata': log.metadata or {},
        'created_at': log.created_at.isoformat(),
    }

    target_groups = {'accounting_logs_admin'}
    if log.group and log.group.main_teacher_id:
        target_groups.add(f'accounting_logs_teacher_{log.group.main_teacher_id}')
    if log.student_id:
        target_groups.add(f'accounting_logs_student_{log.student_id}')

    for group_name in target_groups:
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'accounting_log_event',
                    'payload': payload,
                },
            )
        except Exception as exc:
            logger.debug("Accounting websocket publish failed for group %s: %s", group_name, exc)


def create_activity_log(
    *,
    action_type: str,
    message: str,
    actor: Optional[User] = None,
    student: Optional[User] = None,
    group: Optional[Group] = None,
    attendance: Optional[Attendance] = None,
    payment: Optional[Payment] = None,
    amount_tiyin: Optional[int] = None,
    balance_after_tiyin: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> AccountingActivityLog:
    log = AccountingActivityLog.objects.create(
        action_type=action_type,
        actor=actor,
        student=student,
        group=group,
        attendance=attendance,
        payment=payment,
        message=message,
        amount_tiyin=amount_tiyin,
        balance_after_tiyin=balance_after_tiyin,
        metadata=metadata or {},
    )
    _broadcast_activity_log(log)
    return log


def _get_active_attendance_charge(attendance: Attendance) -> Optional[AttendanceCharge]:
    return (
        AttendanceCharge.objects.filter(
            attendance=attendance,
            entry_type=AttendanceCharge.ENTRY_CHARGE,
            is_active_charge=True,
        )
        .order_by('-created_at', '-id')
        .first()
    )


@transaction.atomic
def post_attendance_charge(attendance: Attendance, actor: Optional[User] = None) -> Optional[AttendanceCharge]:
    """
    Post one lesson charge when attendance becomes PRESENT.
    Idempotent: repeated PRESENT saves do not duplicate active charge rows.
    """
    attendance_locked = (
        Attendance.objects.select_for_update()
        .select_related('student', 'group', 'group__course', 'group__main_teacher')
        .get(pk=attendance.pk)
    )

    if attendance_locked.attendance_status != Attendance.STATUS_PRESENT:
        return None

    active_charge = _get_active_attendance_charge(attendance_locked)
    if active_charge:
        return active_charge

    group = attendance_locked.group
    student = attendance_locked.student
    if not group.course_id:
        logger.warning("Skipping attendance charge because group %s has no course", group.id)
        return None

    course_price_tiyin, denominator, per_lesson_fee_tiyin = calculate_per_lesson_fee_tiyin(
        group=group,
        target_date=attendance_locked.date,
    )
    if per_lesson_fee_tiyin <= 0:
        logger.warning(
            "Skipping attendance charge for attendance_id=%s because per_lesson_fee_tiyin=%s",
            attendance_locked.id,
            per_lesson_fee_tiyin,
        )
        return None

    teacher = group.main_teacher
    teacher_share_percent = TEACHER_SHARE_PERCENT if teacher else 0
    teacher_amount_tiyin, company_amount_tiyin = split_lesson_fee_tiyin(
        per_lesson_fee_tiyin=per_lesson_fee_tiyin,
        teacher_share_percent=teacher_share_percent,
    )

    account = StudentAccount.objects.select_for_update().filter(student=student).first()
    if not account:
        account = get_or_create_student_account(student)
        account = StudentAccount.objects.select_for_update().get(pk=account.pk)
    balance_before_tiyin = int(account.balance_tiyin)
    balance_after_tiyin = balance_before_tiyin - int(per_lesson_fee_tiyin)
    account.balance_tiyin = balance_after_tiyin
    account.save(update_fields=['balance_tiyin', 'updated_at'])

    charge = AttendanceCharge.objects.create(
        attendance=attendance_locked,
        account=account,
        student=student,
        group=group,
        teacher=teacher,
        entry_type=AttendanceCharge.ENTRY_CHARGE,
        is_active_charge=True,
        course_price_tiyin=course_price_tiyin,
        lesson_denominator=denominator,
        per_lesson_fee_tiyin=per_lesson_fee_tiyin,
        teacher_share_percent=teacher_share_percent,
        teacher_amount_tiyin=teacher_amount_tiyin,
        company_amount_tiyin=company_amount_tiyin,
        balance_before_tiyin=balance_before_tiyin,
        balance_after_tiyin=balance_after_tiyin,
        created_by=actor,
        metadata={
            'attendance_status': attendance_locked.attendance_status,
            'pricing_mode': group.billing_mode,
            'planned_monthly_lessons': group.planned_monthly_lessons,
        },
    )

    if teacher and teacher_amount_tiyin:
        TeacherEarnings.objects.create(
            teacher=teacher,
            payment=None,
            attendance_charge=charge,
            student=student,
            group=group,
            source_type=TeacherEarnings.SOURCE_ATTENDANCE,
            entry_type=TeacherEarnings.ENTRY_ACCRUAL,
            payment_amount=per_lesson_fee_tiyin,
            percentage_applied=teacher_share_percent,
            amount=teacher_amount_tiyin,
            date=attendance_locked.date,
            is_paid_to_teacher=False,
        )

    CompanyShareEntry.objects.create(
        charge=charge,
        amount_tiyin=company_amount_tiyin,
    )

    AccountTransaction.objects.create(
        transaction_type='attendance_charge',
        transaction_id=f"ATT-{charge.id}",
        student=student,
        teacher=teacher,
        group=group,
        amount=-per_lesson_fee_tiyin,
        balance_before=balance_before_tiyin,
        balance_after=balance_after_tiyin,
        status='completed',
        description=(
            f"Attendance charge posted for {student.username} on {attendance_locked.date.isoformat()} "
            f"({per_lesson_fee_tiyin / 100:.2f} UZS)"
        ),
        transaction_date=attendance_locked.date,
        created_by=actor,
    )

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_ATTENDANCE_CHARGED,
        message=(
            f"Attendance charge posted for {student.username}: "
            f"{per_lesson_fee_tiyin / 100:.2f} UZS deducted."
        ),
        actor=actor,
        student=student,
        group=group,
        attendance=attendance_locked,
        amount_tiyin=-per_lesson_fee_tiyin,
        balance_after_tiyin=balance_after_tiyin,
        metadata={
            'attendance_charge_id': charge.id,
            'teacher_amount_tiyin': teacher_amount_tiyin,
            'company_amount_tiyin': company_amount_tiyin,
        },
    )

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_TEACHER_ACCRUED,
        message=(
            f"Teacher accrual posted for {teacher.username if teacher else 'N/A'}: "
            f"{teacher_amount_tiyin / 100:.2f} UZS."
        ),
        actor=actor,
        student=student,
        group=group,
        attendance=attendance_locked,
        amount_tiyin=teacher_amount_tiyin,
        metadata={'attendance_charge_id': charge.id},
    )

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_COMPANY_SHARE_RECORDED,
        message=(
            f"Company share recorded from attendance of {student.username}: "
            f"{company_amount_tiyin / 100:.2f} UZS."
        ),
        actor=actor,
        student=student,
        group=group,
        attendance=attendance_locked,
        amount_tiyin=company_amount_tiyin,
        metadata={'attendance_charge_id': charge.id},
    )

    if balance_after_tiyin < 0:
        create_activity_log(
            action_type=AccountingActivityLog.ACTION_DEBT_CREATED,
            message=(
                f"{student.username} is now in debt after attendance charge: "
                f"{abs(balance_after_tiyin) / 100:.2f} UZS."
            ),
            actor=actor,
            student=student,
            group=group,
            attendance=attendance_locked,
            amount_tiyin=balance_after_tiyin,
            balance_after_tiyin=balance_after_tiyin,
            metadata={'attendance_charge_id': charge.id},
        )

    return charge


@transaction.atomic
def reverse_attendance_charge(
    attendance: Attendance,
    *,
    actor: Optional[User] = None,
    reason: str = 'attendance_status_changed',
) -> Optional[AttendanceCharge]:
    """
    Reverse one active attendance charge when attendance leaves PRESENT state.
    Idempotent: if no active charge exists, nothing happens.
    """
    attendance_locked = (
        Attendance.objects.select_for_update()
        .select_related('student', 'group', 'group__main_teacher')
        .get(pk=attendance.pk)
    )
    original_charge = _get_active_attendance_charge(attendance_locked)
    if not original_charge:
        return None

    account = StudentAccount.objects.select_for_update().get(pk=original_charge.account_id)
    balance_before_tiyin = int(account.balance_tiyin)
    balance_after_tiyin = balance_before_tiyin + int(original_charge.per_lesson_fee_tiyin)
    account.balance_tiyin = balance_after_tiyin
    account.save(update_fields=['balance_tiyin', 'updated_at'])

    reversal_charge = AttendanceCharge.objects.create(
        attendance=attendance_locked,
        account=account,
        student=original_charge.student,
        group=original_charge.group,
        teacher=original_charge.teacher,
        entry_type=AttendanceCharge.ENTRY_REVERSAL,
        is_active_charge=False,
        original_charge=original_charge,
        course_price_tiyin=original_charge.course_price_tiyin,
        lesson_denominator=original_charge.lesson_denominator,
        per_lesson_fee_tiyin=-int(original_charge.per_lesson_fee_tiyin),
        teacher_share_percent=original_charge.teacher_share_percent,
        teacher_amount_tiyin=-int(original_charge.teacher_amount_tiyin),
        company_amount_tiyin=-int(original_charge.company_amount_tiyin),
        balance_before_tiyin=balance_before_tiyin,
        balance_after_tiyin=balance_after_tiyin,
        created_by=actor,
        metadata={
            'reason': reason,
            'original_charge_id': original_charge.id,
            'attendance_status': attendance_locked.attendance_status,
        },
    )

    original_charge.is_active_charge = False
    original_charge.save(update_fields=['is_active_charge'])

    original_earning = TeacherEarnings.objects.filter(attendance_charge=original_charge).first()
    if original_charge.teacher and original_charge.teacher_amount_tiyin:
        TeacherEarnings.objects.create(
            teacher=original_charge.teacher,
            payment=None,
            attendance_charge=reversal_charge,
            student=original_charge.student,
            group=original_charge.group,
            source_type=TeacherEarnings.SOURCE_ATTENDANCE,
            entry_type=TeacherEarnings.ENTRY_REVERSAL,
            payment_amount=original_charge.per_lesson_fee_tiyin,
            percentage_applied=original_charge.teacher_share_percent,
            amount=-int(original_charge.teacher_amount_tiyin),
            date=attendance_locked.date,
            is_paid_to_teacher=bool(original_earning.is_paid_to_teacher) if original_earning else False,
        )

    CompanyShareEntry.objects.create(
        charge=reversal_charge,
        amount_tiyin=-int(original_charge.company_amount_tiyin),
    )

    AccountTransaction.objects.create(
        transaction_type='attendance_charge_reversal',
        transaction_id=f"ATT-REV-{reversal_charge.id}",
        student=original_charge.student,
        teacher=original_charge.teacher,
        group=original_charge.group,
        amount=int(original_charge.per_lesson_fee_tiyin),
        balance_before=balance_before_tiyin,
        balance_after=balance_after_tiyin,
        status='completed',
        description=(
            f"Attendance charge reversal for {original_charge.student.username} "
            f"on {attendance_locked.date.isoformat()} ({reason})"
        ),
        transaction_date=attendance_locked.date,
        created_by=actor,
    )

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_ATTENDANCE_REVERSED,
        message=(
            f"Attendance charge reversed for {original_charge.student.username}: "
            f"{original_charge.per_lesson_fee_tiyin / 100:.2f} UZS restored."
        ),
        actor=actor,
        student=original_charge.student,
        group=original_charge.group,
        attendance=attendance_locked,
        amount_tiyin=original_charge.per_lesson_fee_tiyin,
        balance_after_tiyin=balance_after_tiyin,
        metadata={
            'original_charge_id': original_charge.id,
            'reversal_charge_id': reversal_charge.id,
            'reason': reason,
        },
    )
    return reversal_charge


def sync_attendance_financials(attendance: Attendance, actor: Optional[User] = None) -> Optional[AttendanceCharge]:
    if attendance.attendance_status == Attendance.STATUS_PRESENT:
        return post_attendance_charge(attendance, actor=actor)
    return reverse_attendance_charge(attendance, actor=actor, reason='attendance_status_not_present')


@transaction.atomic
def apply_monthly_subscription_charge(
    *,
    student: User,
    group: Group,
    target_date: Optional[date] = None,
    actor: Optional[User] = None,
) -> Tuple[Optional[MonthlySubscriptionCharge], bool]:
    if not target_date:
        target_date = timezone.now().date()
    if not group.course or group.course.price <= 0:
        return None, False

    account = get_or_create_student_account(student)
    charge, created = MonthlySubscriptionCharge.objects.get_or_create(
        student=student,
        group=group,
        year=target_date.year,
        month=target_date.month,
        defaults={
            'account': account,
            'monthly_price_tiyin': int(group.course.price),
            'charged_tiyin': int(group.course.price),
            'final_charge_tiyin': int(group.course.price),
        }
    )
    if not created:
        return charge, False

    account.balance_tiyin -= int(group.course.price)
    account.save(update_fields=['balance_tiyin', 'updated_at'])

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_MONTHLY_DEDUCTION,
        message=(
            f"System deducted {group.course.price / 100:.2f} UZS for monthly subscription "
            f"({group.name}, {target_date.strftime('%Y-%m')})."
        ),
        actor=actor,
        student=student,
        group=group,
        amount_tiyin=-int(group.course.price),
        balance_after_tiyin=account.balance_tiyin,
        metadata={
            'year': target_date.year,
            'month': target_date.month,
            'course_price_tiyin': int(group.course.price),
        },
    )

    if account.balance_tiyin < 0:
        create_activity_log(
            action_type=AccountingActivityLog.ACTION_DEBT_CREATED,
            message=(
                f"Student {student.username} entered debt after monthly deduction: "
                f"{abs(account.balance_tiyin) / 100:.2f} UZS."
            ),
            actor=actor,
            student=student,
            group=group,
            amount_tiyin=account.balance_tiyin,
            balance_after_tiyin=account.balance_tiyin,
        )

    return charge, True


@transaction.atomic
def apply_payment_to_student_account(payment: Payment, actor: Optional[User] = None) -> bool:
    if payment.status != Payment.PaymentStatus.PAID or not payment.by_user:
        return False

    account = get_or_create_student_account(payment.by_user)
    account.balance_tiyin += int(payment.amount)
    account.save(update_fields=['balance_tiyin', 'updated_at'])

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_PAYMENT_RECEIVED,
        message=(
            f"Payment received from {payment.by_user.username}: "
            f"{payment.amount / 100:.2f} UZS."
        ),
        actor=actor,
        student=payment.by_user,
        group=payment.group,
        payment=payment,
        amount_tiyin=int(payment.amount),
        balance_after_tiyin=account.balance_tiyin,
        metadata={'payment_id': payment.id},
    )
    return True


@transaction.atomic
def rollback_paid_payment(payment: Payment, actor: Optional[User] = None) -> bool:
    if payment.status != Payment.PaymentStatus.PAID or not payment.by_user:
        return False

    account = get_or_create_student_account(payment.by_user)
    account.balance_tiyin -= int(payment.amount)
    account.save(update_fields=['balance_tiyin', 'updated_at'])

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_SYSTEM,
        message=(
            f"System reversed a previously paid payment for {payment.by_user.username}: "
            f"{payment.amount / 100:.2f} UZS."
        ),
        actor=actor,
        student=payment.by_user,
        group=payment.group,
        payment=payment,
        amount_tiyin=-int(payment.amount),
        balance_after_tiyin=account.balance_tiyin,
        metadata={'payment_id': payment.id, 'reason': 'payment_update'},
    )
    return True


def _resolve_teacher_for_payment(payment: Payment) -> Optional[User]:
    if getattr(payment, 'teacher_id', None):
        return payment.teacher
    if getattr(payment, 'group_id', None) and payment.group and payment.group.main_teacher_id:
        return payment.group.main_teacher
    return None


def _teacher_share_percent_for_user(teacher: User) -> int:
    raw_percent = getattr(teacher, 'salary_percentage', TEACHER_SHARE_PERCENT) or TEACHER_SHARE_PERCENT
    try:
        parsed_percent = int(raw_percent)
    except (TypeError, ValueError):
        parsed_percent = TEACHER_SHARE_PERCENT
    return max(0, min(parsed_percent, 100))


def _calculate_teacher_earning_amount_tiyin(payment_amount_tiyin: int, share_percent: int) -> int:
    salary_value = Decimal(int(payment_amount_tiyin)) * Decimal(share_percent) / Decimal(100)
    return _round_tiyin(salary_value)


@transaction.atomic
def sync_payment_transaction_for_payment(payment: Payment) -> AccountTransaction:
    balance_before = None
    balance_after = None

    if payment.by_user_id and payment.group_id:
        try:
            balance = StudentBalance.objects.get(student_id=payment.by_user_id, group_id=payment.group_id)
            balance_after = balance.balance
            balance_before = balance_after + int(payment.amount or 0)
        except StudentBalance.DoesNotExist:
            pass

    transaction = (
        AccountTransaction.objects.filter(payment=payment, transaction_type='payment')
        .order_by('-created_at')
        .first()
    )

    if not transaction:
        return AccountTransaction.create_from_payment(payment)

    student_label = payment.by_user.username if payment.by_user else 'Unknown'
    group_label = payment.group.name if payment.group else 'Unknown'

    transaction.student_id = payment.by_user_id
    transaction.group_id = payment.group_id
    transaction.amount = int(payment.amount or 0)
    transaction.balance_before = balance_before
    transaction.balance_after = balance_after
    transaction.status = 'completed' if payment.status == Payment.PaymentStatus.PAID else 'pending'
    transaction.description = f"Payment from {student_label} for {group_label}"
    transaction.reference_number = payment.transaction_id or ''
    transaction.transaction_date = payment.date
    transaction.created_by_id = payment.by_user_id
    transaction.save(
        update_fields=[
            'student',
            'group',
            'amount',
            'balance_before',
            'balance_after',
            'status',
            'description',
            'reference_number',
            'transaction_date',
            'created_by',
        ]
    )
    return transaction


@transaction.atomic
def sync_teacher_earning_for_payment(payment: Payment) -> Optional[TeacherEarnings]:
    existing_earning = TeacherEarnings.objects.filter(payment=payment).first()
    teacher = _resolve_teacher_for_payment(payment)

    if payment.status != Payment.PaymentStatus.PAID or not teacher:
        if existing_earning:
            AccountTransaction.objects.filter(payment=payment, transaction_type='teacher_earning').delete()
            existing_earning.delete()
        return None

    percentage_applied = _teacher_share_percent_for_user(teacher)
    payment_amount = int(payment.amount or 0)
    earning_amount = _calculate_teacher_earning_amount_tiyin(payment_amount, percentage_applied)

    earning, _ = TeacherEarnings.objects.update_or_create(
        payment=payment,
        defaults={
            'teacher': teacher,
            'attendance_charge': None,
            'student': payment.by_user,
            'group': payment.group,
            'source_type': TeacherEarnings.SOURCE_PAYMENT,
            'entry_type': TeacherEarnings.ENTRY_ACCRUAL,
            'payment_amount': payment_amount,
            'percentage_applied': percentage_applied,
            'amount': earning_amount,
            'date': payment.date,
        },
    )

    earning_transaction = (
        AccountTransaction.objects.filter(payment=payment, transaction_type='teacher_earning')
        .order_by('-created_at')
        .first()
    )
    if not earning_transaction:
        AccountTransaction.create_from_teacher_earning(earning)
        return earning

    earning_transaction.teacher = teacher
    earning_transaction.group = payment.group
    earning_transaction.amount = -earning_amount
    earning_transaction.status = 'completed' if earning.is_paid_to_teacher else 'pending'
    earning_transaction.description = f"Teacher earning ({percentage_applied}%) from payment"
    earning_transaction.transaction_date = earning.date
    earning_transaction.save(
        update_fields=[
            'teacher',
            'group',
            'amount',
            'status',
            'description',
            'transaction_date',
        ]
    )
    return earning


@transaction.atomic
def sync_payment_financial_records(payment: Payment) -> None:
    """
    Keep payment-linked financial artifacts aligned with the current payment state.
    """
    sync_payment_transaction_for_payment(payment)


@transaction.atomic
def cleanup_payment_financial_records(payment: Payment) -> None:
    """
    Remove payment-linked derived records when a payment is deleted.
    """
    AccountTransaction.objects.filter(payment=payment, transaction_type__in=['payment', 'teacher_earning']).delete()
    TeacherEarnings.objects.filter(payment=payment).delete()


def _month_attendance_summary(student: User, group: Group, target_date: date):
    queryset = Attendance.objects.filter(
        student=student,
        group=group,
        date__year=target_date.year,
        date__month=target_date.month
    )
    present_count = queryset.filter(attendance_status=Attendance.STATUS_PRESENT).count()
    unexcused_count = queryset.filter(attendance_status=Attendance.STATUS_ABSENT_UNEXCUSED).count()
    excused_count = queryset.filter(attendance_status=Attendance.STATUS_ABSENCE_EXCUSED).count()
    return queryset.count(), present_count, unexcused_count, excused_count


@transaction.atomic
def _settle_charge_and_change_status(
    *,
    student: User,
    group: Group,
    target_date: date,
    target_status: str,
    settlement_status: str,
    chargeable_days: int,
    actor: Optional[User] = None,
) -> None:
    account = get_or_create_student_account(student)
    charge, _ = apply_monthly_subscription_charge(
        student=student,
        group=group,
        target_date=target_date,
        actor=actor,
    )
    if not charge:
        return
    if charge.settlement_status != MonthlySubscriptionCharge.SETTLEMENT_NONE:
        return

    month_divisor = estimate_group_class_days(group, target_date.year, target_date.month)
    daily_rate = Decimal(charge.monthly_price_tiyin) / Decimal(max(month_divisor, 1))
    final_charge_tiyin = min(
        int(charge.monthly_price_tiyin),
        _round_tiyin(daily_rate * Decimal(max(chargeable_days, 0)))
    )
    refundable_tiyin = max(charge.monthly_price_tiyin - final_charge_tiyin - charge.refunded_tiyin, 0)

    if refundable_tiyin > 0:
        account.balance_tiyin += refundable_tiyin
        account.save(update_fields=['balance_tiyin', 'updated_at'])
        charge.refunded_tiyin += refundable_tiyin
        create_activity_log(
            action_type=AccountingActivityLog.ACTION_REFUND_ISSUED,
            message=(
                f"System refunded {refundable_tiyin / 100:.2f} UZS to {student.username} "
                f"after status automation."
            ),
            actor=actor,
            student=student,
            group=group,
            amount_tiyin=refundable_tiyin,
            balance_after_tiyin=account.balance_tiyin,
        )

    charge.settlement_status = settlement_status
    charge.final_charge_tiyin = final_charge_tiyin
    charge.settlement_note = (
        f"daily_rate={daily_rate}, chargeable_days={chargeable_days}, "
        f"final_charge_tiyin={final_charge_tiyin}"
    )
    charge.save(update_fields=['refunded_tiyin', 'final_charge_tiyin', 'settlement_status', 'settlement_note', 'updated_at'])

    account.status = target_status
    account.save(update_fields=['status', 'updated_at', 'status_changed_at'])

    if student.is_active:
        student.is_active = False
        student.save(update_fields=['is_active'])

    action_type = (
        AccountingActivityLog.ACTION_ACCOUNT_DEACTIVATED
        if target_status == StudentAccount.STATUS_DEACTIVATED
        else AccountingActivityLog.ACTION_ACCOUNT_FROZEN
    )
    create_activity_log(
        action_type=action_type,
        message=(
            f"System changed {student.username} to {target_status} status due to attendance policy "
            f"on group {group.name}."
        ),
        actor=actor,
        student=student,
        group=group,
        balance_after_tiyin=account.balance_tiyin,
        metadata={
            'year': target_date.year,
            'month': target_date.month,
            'chargeable_days': chargeable_days,
        },
    )


def apply_attendance_policies(attendance: Attendance, actor: Optional[User] = None) -> None:
    student = attendance.student
    group = attendance.group
    target_date = attendance.date

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_ATTENDANCE_MARKED,
        message=(
            f"{actor.username if actor else 'System'} marked attendance for "
            f"{student.username} as {attendance.attendance_status}."
        ),
        actor=actor,
        student=student,
        group=group,
        attendance=attendance,
        metadata={
            'date': target_date.isoformat(),
            'attendance_status': attendance.attendance_status,
        },
    )
    sync_attendance_financials(attendance, actor=actor)


@transaction.atomic
def reactivate_student_account(
    *,
    student: User,
    actor: Optional[User] = None,
    group: Optional[Group] = None,
) -> StudentAccount:
    account = get_or_create_student_account(student)
    account.status = StudentAccount.STATUS_ACTIVE
    account.save(update_fields=['status', 'updated_at', 'status_changed_at'])

    if not student.is_active:
        student.is_active = True
        student.save(update_fields=['is_active'])

    if group:
        group.students.add(student)

    create_activity_log(
        action_type=AccountingActivityLog.ACTION_ACCOUNT_REACTIVATED,
        message=(
            f"{actor.username if actor else 'System'} reactivated {student.username} "
            f"and resumed billing."
        ),
        actor=actor,
        student=student,
        group=group,
        balance_after_tiyin=account.balance_tiyin,
    )
    return account


def calculate_teacher_salary_tiyin(
    *,
    monthly_price_tiyin: int,
    present_days: int,
    billable_days: int,
    total_sessions: int = DEFAULT_MONTHLY_SESSIONS,
    share_percent: int = TEACHER_SHARE_PERCENT,
) -> int:
    """
    Dynamic teacher salary calculation.
    Active student -> billable_days should be full session count.
    Frozen/deactivated student -> pass prorated billable_days from attendance settlement.
    """
    if monthly_price_tiyin <= 0 or total_sessions <= 0:
        return 0

    bounded_billable_days = max(0, min(billable_days, total_sessions))
    daily_rate = Decimal(monthly_price_tiyin) / Decimal(total_sessions)
    student_revenue_tiyin = _round_tiyin(daily_rate * Decimal(bounded_billable_days))
    salary_value = Decimal(student_revenue_tiyin) * Decimal(share_percent) / Decimal(100)
    return _round_tiyin(salary_value)


def _effective_charge_tiyin(charge: MonthlySubscriptionCharge) -> int:
    if charge.final_charge_tiyin > 0:
        return int(charge.final_charge_tiyin)
    if charge.settlement_status == MonthlySubscriptionCharge.SETTLEMENT_NONE:
        return int(charge.monthly_price_tiyin)
    return max(int(charge.charged_tiyin) - int(charge.refunded_tiyin), 0)


@transaction.atomic
def set_student_account_status(
    *,
    student: User,
    target_status: str,
    actor: Optional[User] = None,
    group: Optional[Group] = None,
    reason: Optional[str] = None,
) -> StudentAccount:
    if target_status not in {
        StudentAccount.STATUS_ACTIVE,
        StudentAccount.STATUS_FROZEN,
        StudentAccount.STATUS_DEACTIVATED,
    }:
        raise ValueError(f"Unsupported student account status: {target_status}")

    account = get_or_create_student_account(student)
    previous_status = account.status

    if previous_status != target_status:
        account.status = target_status
        account.save(update_fields=['status', 'updated_at', 'status_changed_at'])

    should_be_active = target_status == StudentAccount.STATUS_ACTIVE
    if student.is_active != should_be_active:
        student.is_active = should_be_active
        student.save(update_fields=['is_active'])

    if should_be_active and group:
        group.students.add(student)

    if previous_status != target_status:
        actor_name = actor.username if actor else 'System'
        action_type = {
            StudentAccount.STATUS_ACTIVE: AccountingActivityLog.ACTION_ACCOUNT_REACTIVATED,
            StudentAccount.STATUS_FROZEN: AccountingActivityLog.ACTION_ACCOUNT_FROZEN,
            StudentAccount.STATUS_DEACTIVATED: AccountingActivityLog.ACTION_ACCOUNT_DEACTIVATED,
        }[target_status]
        create_activity_log(
            action_type=action_type,
            message=(
                f"{actor_name} changed {student.username} account status "
                f"from {previous_status} to {target_status}."
            ),
            actor=actor,
            student=student,
            group=group,
            balance_after_tiyin=account.balance_tiyin,
            metadata={
                'manual': True,
                'reason': reason or 'manual_status_change',
                'previous_status': previous_status,
                'target_status': target_status,
            },
        )

    return account


def calculate_group_teacher_payroll_tiyin(group: Group, share_percent: int = TEACHER_SHARE_PERCENT) -> int:
    total = (
        TeacherEarnings.objects.filter(
            group=group,
            source_type=TeacherEarnings.SOURCE_ATTENDANCE,
            is_paid_to_teacher=False,
        ).aggregate(total=Sum('amount'))['total'] or 0
    )
    return max(int(total), 0)


def teacher_payroll_owed_tiyin(share_percent: int = TEACHER_SHARE_PERCENT) -> int:
    total = (
        TeacherEarnings.objects.filter(is_paid_to_teacher=False).aggregate(total=Sum('amount'))['total'] or 0
    )
    return max(int(total), 0)


def accounting_realtime_metrics():
    total_income_tiyin = (
        Payment.objects.filter(status=Payment.PaymentStatus.PAID).aggregate(total=Sum('amount'))['total'] or 0
    )
    total_balance_tiyin = (
        StudentAccount.objects.aggregate(total=Sum('balance_tiyin'))['total'] or 0
    )
    total_debt_tiyin = (
        StudentAccount.objects.filter(balance_tiyin__lt=0).aggregate(total=Sum('balance_tiyin'))['total'] or 0
    )
    teacher_payroll_tiyin = (
        TeacherEarnings.objects.filter(is_paid_to_teacher=False).aggregate(total=Sum('amount'))['total'] or 0
    )
    company_share_tiyin = (
        CompanyShareEntry.objects.aggregate(total=Sum('amount_tiyin'))['total'] or 0
    )
    net_profit_tiyin = int(company_share_tiyin)

    return {
        'total_income_tiyin': int(total_income_tiyin),
        'total_debt_tiyin': abs(int(total_debt_tiyin)),
        'raw_debt_tiyin': int(total_debt_tiyin),
        'total_balance_tiyin': int(total_balance_tiyin),
        'net_profit_tiyin': int(net_profit_tiyin),
        'teacher_payroll_tiyin': max(int(teacher_payroll_tiyin), 0),
        'company_share_tiyin': int(company_share_tiyin),
    }

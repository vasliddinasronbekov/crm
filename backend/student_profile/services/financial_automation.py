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
    AccountingActivityLog,
    MonthlySubscriptionCharge,
    StudentAccount,
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


def get_or_create_student_account(student: User) -> StudentAccount:
    account, _ = StudentAccount.objects.get_or_create(student=student)
    return account


def _broadcast_activity_log(log: AccountingActivityLog) -> None:
    channel_layer = get_channel_layer()
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

    _, present_count, unexcused_count, excused_count = _month_attendance_summary(student, group, target_date)

    if unexcused_count >= 3:
        chargeable_days = present_count + min(unexcused_count, 3)
        _settle_charge_and_change_status(
            student=student,
            group=group,
            target_date=target_date,
            target_status=StudentAccount.STATUS_DEACTIVATED,
            settlement_status=MonthlySubscriptionCharge.SETTLEMENT_DEACTIVATED,
            chargeable_days=chargeable_days,
            actor=actor,
        )
        return

    if excused_count >= 3:
        _settle_charge_and_change_status(
            student=student,
            group=group,
            target_date=target_date,
            target_status=StudentAccount.STATUS_FROZEN,
            settlement_status=MonthlySubscriptionCharge.SETTLEMENT_FROZEN,
            chargeable_days=present_count,
            actor=actor,
        )


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


def calculate_group_teacher_payroll_tiyin(group: Group, share_percent: int = TEACHER_SHARE_PERCENT) -> int:
    charges = MonthlySubscriptionCharge.objects.filter(group=group)
    total = 0
    for charge in charges:
        salary_value = Decimal(_effective_charge_tiyin(charge)) * Decimal(share_percent) / Decimal(100)
        total += _round_tiyin(salary_value)
    return total


def teacher_payroll_owed_tiyin(share_percent: int = TEACHER_SHARE_PERCENT) -> int:
    charges = MonthlySubscriptionCharge.objects.select_related('group').filter(group__main_teacher__isnull=False)
    total = 0
    for charge in charges:
        salary_value = Decimal(_effective_charge_tiyin(charge)) * Decimal(share_percent) / Decimal(100)
        total += _round_tiyin(salary_value)
    return int(total)


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
    teacher_payroll_tiyin = teacher_payroll_owed_tiyin()
    net_profit_tiyin = total_income_tiyin + total_balance_tiyin

    return {
        'total_income_tiyin': int(total_income_tiyin),
        'total_debt_tiyin': abs(int(total_debt_tiyin)),
        'raw_debt_tiyin': int(total_debt_tiyin),
        'total_balance_tiyin': int(total_balance_tiyin),
        'net_profit_tiyin': int(net_profit_tiyin),
        'teacher_payroll_tiyin': int(teacher_payroll_tiyin),
    }

from __future__ import annotations

from typing import Tuple

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum

User = get_user_model()


class InsufficientCoinsError(ValueError):
    pass


def get_student_coin_balance(student: User) -> int:
    from student_profile.models import StudentCoins

    return StudentCoins.objects.filter(student=student).aggregate(total=Sum('coin'))['total'] or 0


@transaction.atomic
def debit_student_coins(student: User, amount: int, reason: str) -> Tuple[StudentCoins, int]:
    from student_profile.models import StudentCoins

    if amount <= 0:
        raise ValueError("amount must be positive")

    # Serialize wallet updates per user to avoid race conditions.
    User.objects.select_for_update().get(pk=student.pk)
    current_balance = get_student_coin_balance(student)
    if current_balance < amount:
        raise InsufficientCoinsError(
            f"Insufficient coins. You have {current_balance}, need {amount}"
        )

    transaction_record = StudentCoins.objects.create(
        student=student,
        coin=-amount,
        reason=reason,
    )
    return transaction_record, current_balance - amount


@transaction.atomic
def credit_student_coins(student: User, amount: int, reason: str) -> Tuple[StudentCoins, int]:
    from student_profile.models import StudentCoins

    if amount <= 0:
        raise ValueError("amount must be positive")

    User.objects.select_for_update().get(pk=student.pk)
    current_balance = get_student_coin_balance(student)
    transaction_record = StudentCoins.objects.create(
        student=student,
        coin=amount,
        reason=reason,
    )
    return transaction_record, current_balance + amount

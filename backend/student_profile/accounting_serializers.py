from typing import Any
# Serializers for Automatic Accounting Models

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers
from .accounting_models import (
    StudentAccount,
    MonthlySubscriptionCharge,
    AccountingActivityLog,
    StudentBalance,
    TeacherEarnings,
    StudentFine,
    FinancialSummary,
    AccountTransaction,
)
from .models import Group, AutomaticFine
from users.models import User


def tiyin_to_uzs(value: Any) -> Any:
    if value is None:
        return None
    return Decimal(value) / Decimal(100)


class StudentBalanceSerializer(serializers.ModelSerializer):
    """Serializer for StudentBalance model"""

    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    course_name = serializers.CharField(source='group.course.name', read_only=True)
    branch_name = serializers.CharField(source='group.branch.name', read_only=True)

    # Display amounts in sum (UZS) for readability
    total_fee_tiyin = serializers.IntegerField(source='total_fee', read_only=True)
    paid_amount_tiyin = serializers.IntegerField(source='paid_amount', read_only=True)
    fine_amount_tiyin = serializers.IntegerField(source='fine_amount', read_only=True)
    balance_tiyin = serializers.IntegerField(source='balance', read_only=True)
    total_fee_sum = serializers.DecimalField(
        source='total_fee_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    paid_amount_sum = serializers.DecimalField(
        source='paid_amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    balance_sum = serializers.DecimalField(
        source='balance_in_sum',
        max_digits=12,
        decimal_places=4,
        read_only=True
    )
    total_fee_uzs = serializers.SerializerMethodField()
    paid_amount_uzs = serializers.SerializerMethodField()
    fine_amount_uzs = serializers.SerializerMethodField()
    balance_uzs = serializers.SerializerMethodField()
    payment_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = StudentBalance
        fields = [
            'id',
            'student',
            'student_name',
            'student_username',
            'group',
            'group_name',
            'course_name',
            'branch_name',
            'total_fee',
            'total_fee_tiyin',
            'total_fee_sum',
            'total_fee_uzs',
            'paid_amount',
            'paid_amount_tiyin',
            'paid_amount_sum',
            'paid_amount_uzs',
            'fine_amount',
            'balance',
            'fine_amount_tiyin',
            'balance_tiyin',
            'fine_amount_uzs',
            'balance_coins',
            'balance_sum',
            'balance_uzs',
            'is_fully_paid',
            'payment_percentage',
            'last_payment_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'balance',
            'balance_coins',
            'is_fully_paid',
            'payment_percentage',
            'created_at',
            'updated_at',
        ]

    def get_total_fee_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.total_fee)

    def get_paid_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.paid_amount)

    def get_fine_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.fine_amount)

    def get_balance_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.balance)


class TeacherEarningsSerializer(serializers.ModelSerializer):
    """Serializer for TeacherEarnings model"""

    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    teacher_username = serializers.CharField(source='teacher.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    payment_id = serializers.SerializerMethodField()
    attendance_charge_id = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    # Display amounts in sum (UZS)
    payment_amount_tiyin = serializers.IntegerField(source='payment_amount', read_only=True)
    amount_tiyin = serializers.IntegerField(source='amount', read_only=True)
    payment_amount_sum = serializers.SerializerMethodField()
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    payment_amount_uzs = serializers.SerializerMethodField()
    amount_uzs = serializers.SerializerMethodField()

    class Meta:
        model = TeacherEarnings
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'teacher_username',
            'payment',
            'payment_id',
            'attendance_charge_id',
            'student_name',
            'group',
            'group_name',
            'source_type',
            'entry_type',
            'payment_amount',
            'payment_amount_tiyin',
            'payment_amount_sum',
            'payment_amount_uzs',
            'percentage_applied',
            'amount',
            'amount_tiyin',
            'amount_sum',
            'amount_uzs',
            'is_paid_to_teacher',
            'paid_date',
            'date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'payment_amount',
            'amount',
            'date',
            'created_at',
            'updated_at',
        ]

    def get_payment_amount_sum(self, obj) -> Any:
        return obj.payment_amount / 100

    def get_payment_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.payment_amount)

    def get_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.amount)

    def get_payment_id(self, obj) -> Any:
        return obj.payment_id

    def get_attendance_charge_id(self, obj) -> Any:
        return obj.attendance_charge_id

    def get_student_name(self, obj) -> str:
        if obj.student:
            full_name = obj.student.get_full_name().strip()
            if full_name:
                return full_name
            return obj.student.username
        if obj.payment and obj.payment.by_user:
            full_name = obj.payment.by_user.get_full_name().strip()
            if full_name:
                return full_name
            return obj.payment.by_user.username
        return ''


class TeacherEarningsSummarySerializer(serializers.Serializer):
    """Summary serializer for teacher earnings aggregation"""

    teacher_id = serializers.IntegerField()
    teacher_name = serializers.CharField()
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_unpaid = serializers.DecimalField(max_digits=12, decimal_places=2)
    earning_count = serializers.IntegerField()


class StudentFineSerializer(serializers.ModelSerializer):
    """Serializer for StudentFine model"""

    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    fine_type_name = serializers.CharField(source='fine_type.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    # Display amount in sum (UZS)
    amount_tiyin = serializers.IntegerField(source='amount', read_only=True)
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    amount_uzs = serializers.SerializerMethodField()

    class Meta:
        model = StudentFine
        fields = [
            'id',
            'student',
            'student_name',
            'student_username',
            'fine_type',
            'fine_type_name',
            'group',
            'group_name',
            'amount',
            'amount_tiyin',
            'amount_sum',
            'amount_uzs',
            'reason',
            'description',
            'is_paid',
            'paid_date',
            'attendance',
            'is_automatic',
            'applied_date',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]

    def get_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.amount)
        read_only_fields = [
            'is_automatic',
            'created_at',
            'updated_at',
        ]


class FinancialSummarySerializer(serializers.ModelSerializer):
    """Serializer for FinancialSummary model"""

    branch_name = serializers.CharField(source='branch.name', read_only=True)

    # Display all amounts in sum (UZS)
    total_payments_sum = serializers.DecimalField(
        source='total_payments_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    total_expenses_sum = serializers.SerializerMethodField()
    total_teacher_earnings_sum = serializers.SerializerMethodField()
    teacher_earnings_paid_sum = serializers.SerializerMethodField()
    total_fines_sum = serializers.SerializerMethodField()
    fines_paid_sum = serializers.SerializerMethodField()
    gross_revenue_sum = serializers.SerializerMethodField()
    net_profit_sum = serializers.DecimalField(
        source='net_profit_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    total_payments_uzs = serializers.SerializerMethodField()
    total_expenses_uzs = serializers.SerializerMethodField()
    total_teacher_earnings_uzs = serializers.SerializerMethodField()
    teacher_earnings_paid_uzs = serializers.SerializerMethodField()
    total_fines_uzs = serializers.SerializerMethodField()
    fines_paid_uzs = serializers.SerializerMethodField()
    gross_revenue_uzs = serializers.SerializerMethodField()
    net_profit_uzs = serializers.SerializerMethodField()

    class Meta:
        model = FinancialSummary
        fields = [
            'id',
            'date',
            'branch',
            'branch_name',
            'total_payments',
            'total_payments_sum',
            'total_payments_uzs',
            'payment_count',
            'total_expenses',
            'total_expenses_sum',
            'total_expenses_uzs',
            'expense_count',
            'total_teacher_earnings',
            'total_teacher_earnings_sum',
            'total_teacher_earnings_uzs',
            'teacher_earnings_paid',
            'teacher_earnings_paid_sum',
            'teacher_earnings_paid_uzs',
            'total_fines',
            'total_fines_sum',
            'total_fines_uzs',
            'fines_paid',
            'fines_paid_sum',
            'fines_paid_uzs',
            'gross_revenue',
            'gross_revenue_sum',
            'gross_revenue_uzs',
            'net_profit',
            'net_profit_sum',
            'net_profit_uzs',
            'calculated_at',
            'created_at',
        ]
        read_only_fields = [
            'total_payments',
            'payment_count',
            'total_expenses',
            'expense_count',
            'total_teacher_earnings',
            'teacher_earnings_paid',
            'total_fines',
            'fines_paid',
            'gross_revenue',
            'net_profit',
            'calculated_at',
            'created_at',
        ]

    def get_total_expenses_sum(self, obj) -> Any:
        return obj.total_expenses / 100

    def get_total_payments_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.total_payments)

    def get_total_expenses_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.total_expenses)

    def get_total_teacher_earnings_sum(self, obj) -> Any:
        return obj.total_teacher_earnings / 100

    def get_total_teacher_earnings_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.total_teacher_earnings)

    def get_teacher_earnings_paid_sum(self, obj) -> Any:
        return obj.teacher_earnings_paid / 100

    def get_teacher_earnings_paid_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.teacher_earnings_paid)

    def get_total_fines_sum(self, obj) -> Any:
        return obj.total_fines / 100

    def get_total_fines_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.total_fines)

    def get_fines_paid_sum(self, obj) -> Any:
        return obj.fines_paid / 100

    def get_fines_paid_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.fines_paid)

    def get_gross_revenue_sum(self, obj) -> Any:
        return obj.gross_revenue / 100

    def get_gross_revenue_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.gross_revenue)

    def get_net_profit_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.net_profit)


class StudentBalanceCreateSerializer(serializers.Serializer):
    """Serializer for manually creating student balance"""

    student_id = serializers.IntegerField()
    group_id = serializers.IntegerField()

    def validate_student_id(self, value):
        try:
            student = User.objects.get(id=value, is_teacher=False)
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("Student not found")

    def validate_group_id(self, value):
        try:
            group = Group.objects.get(id=value)
            return value
        except Group.DoesNotExist:
            raise serializers.ValidationError("Group not found")

    def validate(self, data):
        # Check if balance already exists
        existing = StudentBalance.objects.filter(
            student_id=data['student_id'],
            group_id=data['group_id']
        ).exists()

        if existing:
            raise serializers.ValidationError("Balance already exists for this student and group")

        return data


class ApplyFineSerializer(serializers.Serializer):
    """Serializer for manually applying a fine to a student"""

    student_id = serializers.IntegerField()
    fine_type_id = serializers.IntegerField()
    group_id = serializers.IntegerField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_student_id(self, value):
        try:
            User.objects.get(id=value, is_teacher=False)
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("Student not found")

    def validate_fine_type_id(self, value):
        try:
            AutomaticFine.objects.get(id=value)
            return value
        except AutomaticFine.DoesNotExist:
            raise serializers.ValidationError("Fine type not found")


class AccountTransactionSerializer(serializers.ModelSerializer):
    """Serializer for AccountTransaction model"""

    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    teacher_username = serializers.CharField(source='teacher.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    # Display amounts in sum (UZS)
    amount_tiyin = serializers.IntegerField(source='amount', read_only=True)
    balance_before_tiyin = serializers.IntegerField(source='balance_before', read_only=True)
    balance_after_tiyin = serializers.IntegerField(source='balance_after', read_only=True)
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    amount_uzs = serializers.SerializerMethodField()
    balance_before_sum = serializers.SerializerMethodField()
    balance_after_sum = serializers.SerializerMethodField()
    balance_before_uzs = serializers.SerializerMethodField()
    balance_after_uzs = serializers.SerializerMethodField()

    class Meta:
        model = AccountTransaction
        fields = [
            'id',
            'transaction_type',
            'transaction_id',
            'payment',
            'student',
            'student_name',
            'student_username',
            'teacher',
            'teacher_name',
            'teacher_username',
            'group',
            'group_name',
            'amount',
            'amount_tiyin',
            'amount_sum',
            'amount_uzs',
            'balance_before',
            'balance_before_tiyin',
            'balance_before_sum',
            'balance_before_uzs',
            'balance_after',
            'balance_after_tiyin',
            'balance_after_sum',
            'balance_after_uzs',
            'status',
            'description',
            'reference_number',
            'created_by',
            'created_by_name',
            'created_at',
            'transaction_date',
        ]
        read_only_fields = [
            'transaction_id',
            'amount',
            'balance_before',
            'balance_after',
            'created_at',
        ]

    def get_amount_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.amount)

    def get_balance_before_sum(self, obj) -> Any:
        return obj.balance_before / 100 if obj.balance_before is not None else None

    def get_balance_before_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.balance_before)

    def get_balance_after_sum(self, obj) -> Any:
        return obj.balance_after / 100 if obj.balance_after is not None else None

    def get_balance_after_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.balance_after)


class StudentAccountSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    balance_sum = serializers.DecimalField(
        source='balance_in_sum',
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    balance_uzs = serializers.SerializerMethodField()

    class Meta:
        model = StudentAccount
        fields = [
            'id',
            'student',
            'student_name',
            'student_username',
            'balance_tiyin',
            'balance_sum',
            'balance_uzs',
            'status',
            'status_changed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['status_changed_at', 'created_at', 'updated_at']

    def get_balance_uzs(self, obj) -> Any:
        return tiyin_to_uzs(obj.balance_tiyin)


class MonthlySubscriptionChargeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    teacher_share_tiyin = serializers.SerializerMethodField()

    class Meta:
        model = MonthlySubscriptionCharge
        fields = [
            'id',
            'student',
            'student_name',
            'group',
            'group_name',
            'year',
            'month',
            'monthly_price_tiyin',
            'charged_tiyin',
            'final_charge_tiyin',
            'refunded_tiyin',
            'teacher_share_tiyin',
            'settlement_status',
            'settlement_note',
            'charged_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_teacher_share_tiyin(self, obj) -> Any:
        base = obj.final_charge_tiyin or obj.monthly_price_tiyin
        return int((Decimal(base) * Decimal('0.4')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


class AccountingActivityLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = AccountingActivityLog
        fields = [
            'id',
            'action_type',
            'actor',
            'actor_username',
            'student',
            'student_username',
            'group',
            'group_name',
            'attendance',
            'payment',
            'message',
            'amount_tiyin',
            'balance_after_tiyin',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields

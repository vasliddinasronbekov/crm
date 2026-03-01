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


class StudentBalanceSerializer(serializers.ModelSerializer):
    """Serializer for StudentBalance model"""

    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    course_name = serializers.CharField(source='group.course.name', read_only=True)
    branch_name = serializers.CharField(source='group.branch.name', read_only=True)

    # Display amounts in sum (UZS) for readability
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
            'total_fee_sum',
            'paid_amount',
            'paid_amount_sum',
            'fine_amount',
            'balance',
            'balance_coins',
            'balance_sum',
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


class TeacherEarningsSerializer(serializers.ModelSerializer):
    """Serializer for TeacherEarnings model"""

    teacher_name = serializers.CharField(source='teacher.get_full_name', read_only=True)
    teacher_username = serializers.CharField(source='teacher.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    payment_id = serializers.IntegerField(source='payment.id', read_only=True)
    student_name = serializers.CharField(source='payment.by_user.get_full_name', read_only=True)

    # Display amounts in sum (UZS)
    payment_amount_sum = serializers.SerializerMethodField()
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = TeacherEarnings
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'teacher_username',
            'payment',
            'payment_id',
            'student_name',
            'group',
            'group_name',
            'payment_amount',
            'payment_amount_sum',
            'percentage_applied',
            'amount',
            'amount_sum',
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

    def get_payment_amount_sum(self, obj):
        return obj.payment_amount / 100


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
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )

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
            'amount_sum',
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

    class Meta:
        model = FinancialSummary
        fields = [
            'id',
            'date',
            'branch',
            'branch_name',
            'total_payments',
            'total_payments_sum',
            'payment_count',
            'total_expenses',
            'total_expenses_sum',
            'expense_count',
            'total_teacher_earnings',
            'total_teacher_earnings_sum',
            'teacher_earnings_paid',
            'teacher_earnings_paid_sum',
            'total_fines',
            'total_fines_sum',
            'fines_paid',
            'fines_paid_sum',
            'gross_revenue',
            'gross_revenue_sum',
            'net_profit',
            'net_profit_sum',
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

    def get_total_expenses_sum(self, obj):
        return obj.total_expenses / 100

    def get_total_teacher_earnings_sum(self, obj):
        return obj.total_teacher_earnings / 100

    def get_teacher_earnings_paid_sum(self, obj):
        return obj.teacher_earnings_paid / 100

    def get_total_fines_sum(self, obj):
        return obj.total_fines / 100

    def get_fines_paid_sum(self, obj):
        return obj.fines_paid / 100

    def get_gross_revenue_sum(self, obj):
        return obj.gross_revenue / 100


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
    amount_sum = serializers.DecimalField(
        source='amount_in_sum',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    balance_before_sum = serializers.SerializerMethodField()
    balance_after_sum = serializers.SerializerMethodField()

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
            'amount_sum',
            'balance_before',
            'balance_before_sum',
            'balance_after',
            'balance_after_sum',
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

    def get_balance_before_sum(self, obj):
        return obj.balance_before / 100 if obj.balance_before is not None else None

    def get_balance_after_sum(self, obj):
        return obj.balance_after / 100 if obj.balance_after is not None else None


class StudentAccountSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)
    balance_sum = serializers.DecimalField(
        source='balance_in_sum',
        max_digits=14,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = StudentAccount
        fields = [
            'id',
            'student',
            'student_name',
            'student_username',
            'balance_tiyin',
            'balance_sum',
            'status',
            'status_changed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['status_changed_at', 'created_at', 'updated_at']


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

    def get_teacher_share_tiyin(self, obj):
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

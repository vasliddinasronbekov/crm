# Automatic Accounting Models
# These models handle automated financial tracking, student balances, teacher earnings, and fines

from django.db import models
from django.utils import timezone
from users.models import User
from .models import Group, Payment, Attendance, AutomaticFine


class StudentAccount(models.Model):
    """
    Internal student wallet/account.
    Positive balance_tiyin means prepaid credit, negative means debt.
    """

    STATUS_ACTIVE = 'active'
    STATUS_FROZEN = 'frozen'
    STATUS_DEACTIVATED = 'deactivated'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_FROZEN, 'Frozen'),
        (STATUS_DEACTIVATED, 'Deactivated'),
    ]

    student = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_account',
        limit_choices_to={'is_teacher': False}
    )
    balance_tiyin = models.BigIntegerField(
        default=0,
        help_text="Current balance in tiyin. Negative means debt."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True
    )
    status_changed_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['student__username']
        verbose_name = "Student Account"
        verbose_name_plural = "Student Accounts"

    def __str__(self):
        return f"{self.student.username} | {self.balance_tiyin / 100} UZS | {self.status}"

    @property
    def balance_in_sum(self):
        return self.balance_tiyin / 100


class MonthlySubscriptionCharge(models.Model):
    """
    Idempotent monthly billing record per student-group.
    """

    SETTLEMENT_NONE = 'none'
    SETTLEMENT_DEACTIVATED = 'deactivated'
    SETTLEMENT_FROZEN = 'frozen'
    SETTLEMENT_CHOICES = [
        (SETTLEMENT_NONE, 'No settlement'),
        (SETTLEMENT_DEACTIVATED, 'Deactivated after 3 unexcused absences'),
        (SETTLEMENT_FROZEN, 'Frozen after 3 excused absences'),
    ]

    account = models.ForeignKey(
        StudentAccount,
        on_delete=models.CASCADE,
        related_name='monthly_charges'
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='monthly_subscription_charges',
        limit_choices_to={'is_teacher': False}
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='monthly_subscription_charges'
    )
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()
    monthly_price_tiyin = models.BigIntegerField(help_text="Course monthly price in tiyin")
    charged_tiyin = models.BigIntegerField(help_text="How much was deducted at month start")
    final_charge_tiyin = models.BigIntegerField(
        default=0,
        help_text="Final charge after attendance-based settlements in tiyin"
    )
    refunded_tiyin = models.BigIntegerField(default=0, help_text="Refund returned to internal balance")
    settlement_status = models.CharField(
        max_length=20,
        choices=SETTLEMENT_CHOICES,
        default=SETTLEMENT_NONE
    )
    settlement_note = models.TextField(blank=True)
    charged_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'group', 'year', 'month']
        ordering = ['-year', '-month', '-charged_at']
        verbose_name = "Monthly Subscription Charge"
        verbose_name_plural = "Monthly Subscription Charges"

    def __str__(self):
        return f"{self.student.username} | {self.group.name} | {self.month}/{self.year}"

    @property
    def remaining_refundable_tiyin(self):
        remaining = self.monthly_price_tiyin - self.refunded_tiyin
        return remaining if remaining > 0 else 0


class AccountingActivityLog(models.Model):
    """
    Real-time accounting and automation activity log.
    """

    ACTION_PAYMENT_RECEIVED = 'payment_received'
    ACTION_MONTHLY_DEDUCTION = 'monthly_deduction'
    ACTION_DEBT_CREATED = 'debt_created'
    ACTION_REFUND_ISSUED = 'refund_issued'
    ACTION_ATTENDANCE_MARKED = 'attendance_marked'
    ACTION_ACCOUNT_DEACTIVATED = 'account_deactivated'
    ACTION_ACCOUNT_FROZEN = 'account_frozen'
    ACTION_ACCOUNT_REACTIVATED = 'account_reactivated'
    ACTION_SYSTEM = 'system_action'

    ACTION_CHOICES = [
        (ACTION_PAYMENT_RECEIVED, 'Payment received'),
        (ACTION_MONTHLY_DEDUCTION, 'Monthly deduction'),
        (ACTION_DEBT_CREATED, 'Debt created'),
        (ACTION_REFUND_ISSUED, 'Refund issued'),
        (ACTION_ATTENDANCE_MARKED, 'Attendance marked'),
        (ACTION_ACCOUNT_DEACTIVATED, 'Account deactivated'),
        (ACTION_ACCOUNT_FROZEN, 'Account frozen'),
        (ACTION_ACCOUNT_REACTIVATED, 'Account reactivated'),
        (ACTION_SYSTEM, 'System action'),
    ]

    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_activity_actor'
    )
    student = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_activity_student'
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_activity_logs'
    )
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_logs'
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_logs'
    )
    message = models.CharField(max_length=500)
    amount_tiyin = models.BigIntegerField(null=True, blank=True)
    balance_after_tiyin = models.BigIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Accounting Activity Log"
        verbose_name_plural = "Accounting Activity Logs"
        indexes = [
            models.Index(fields=['-created_at', 'action_type'], name='acctlog_created_action_idx'),
            models.Index(fields=['student', '-created_at'], name='acctlog_student_created_idx'),
        ]

    def __str__(self):
        return f"{self.action_type} | {self.message[:80]}"


class StudentBalance(models.Model):
    """
    Tracks student payment balances per group enrollment.
    Automatically updated when payments are made.
    """
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='balances',
        limit_choices_to={'is_teacher': False}
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='student_balances'
    )

    # Financial tracking
    total_fee = models.BigIntegerField(
        help_text="Total course fee in tiyin (from course price)"
    )
    paid_amount = models.BigIntegerField(
        default=0,
        help_text="Total amount paid by student in tiyin"
    )
    fine_amount = models.BigIntegerField(
        default=0,
        help_text="Total fines applied in tiyin"
    )
    balance = models.BigIntegerField(
        help_text="Remaining balance in tiyin (negative = overpaid, positive = debt)"
    )
    balance_coins = models.BigIntegerField(
        default=0,
        help_text="Remaining balance in coins (1 UZS = 10,000 coins)"
    )

    # Status tracking
    is_fully_paid = models.BooleanField(
        default=False,
        help_text="True when balance <= 0"
    )
    last_payment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of most recent payment"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['student', 'group']
        ordering = ['-created_at']
        verbose_name = "Student Balance"
        verbose_name_plural = "Student Balances"

    def __str__(self):
        return f"{self.student.username} - {self.group.name} - Balance: {self.balance / 100} UZS"

    def calculate_balance(self):
        """
        Recalculate balance based on total_fee, paid_amount, and fine_amount.
        Balance = (total_fee + fine_amount) - paid_amount
        """
        balance_tiyin = (self.total_fee + self.fine_amount) - self.paid_amount
        self.balance = balance_tiyin
        # Keep a higher-precision representation in 0.0001 UZS units.
        self.balance_coins = balance_tiyin * 100
        self.is_fully_paid = self.balance_coins <= 0
        self.save(update_fields=['balance', 'balance_coins', 'is_fully_paid', 'updated_at'])

    def add_payment(self, amount, payment_date=None):
        """
        Add a payment and recalculate balance.
        """
        self.paid_amount += amount
        self.last_payment_date = payment_date or timezone.now().date()
        self.calculate_balance()

    def add_fine(self, amount):
        """
        Add a fine and recalculate balance.
        """
        self.fine_amount += amount
        self.calculate_balance()

    def add_charge(self, amount):
        """
        Add a charge (like a monthly fee) and recalculate balance.
        """
        self.total_fee += amount
        self.calculate_balance()

    @property
    def balance_in_sum(self):
        """Return balance in sum (UZS) instead of tiyin"""
        if self.balance_coins:
            return self.balance_coins / 10000
        return self.balance / 100

    @property
    def total_fee_in_sum(self):
        """Return total fee in sum (UZS) instead of tiyin"""
        return self.total_fee / 100

    @property
    def paid_amount_in_sum(self):
        """Return paid amount in sum (UZS) instead of tiyin"""
        return self.paid_amount / 100

    @property
    def payment_percentage(self):
        """Calculate what percentage has been paid"""
        if self.total_fee == 0:
            return 100
        return (self.paid_amount / (self.total_fee + self.fine_amount)) * 100


class TeacherEarnings(models.Model):
    """
    Tracks teacher earnings from student payments.
    Automatically created when a payment is marked as 'paid'.
    """
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='earnings',
        limit_choices_to={'is_teacher': True}
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name='teacher_earning',
        help_text="Source payment that generated this earning"
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teacher_earnings'
    )

    # Earning details
    payment_amount = models.BigIntegerField(
        help_text="Original payment amount in tiyin"
    )
    percentage_applied = models.PositiveIntegerField(
        help_text="Teacher's salary percentage (e.g., 40 for 40%)"
    )
    amount = models.BigIntegerField(
        help_text="Teacher's earning amount in tiyin"
    )

    # Payment tracking
    is_paid_to_teacher = models.BooleanField(
        default=False,
        help_text="Has this earning been paid to the teacher?"
    )
    paid_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when teacher received payment"
    )

    # Metadata
    date = models.DateField(
        default=timezone.now,
        help_text="Date when earning was generated"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = "Teacher Earning"
        verbose_name_plural = "Teacher Earnings"

    def __str__(self):
        return f"{self.teacher.username} - {self.amount / 100} UZS ({self.percentage_applied}%)"

    @property
    def amount_in_sum(self):
        """Return amount in sum (UZS) instead of tiyin"""
        return self.amount / 100

    def mark_as_paid(self, paid_date=None):
        """Mark this earning as paid to teacher"""
        self.is_paid_to_teacher = True
        self.paid_date = paid_date or timezone.now().date()
        self.save(update_fields=['is_paid_to_teacher', 'paid_date', 'updated_at'])


class StudentFine(models.Model):
    """
    Tracks fines applied to students (e.g., for absences).
    Can be automatically created or manually added.
    """
    FINE_REASONS = [
        ('absence', 'Absence from class'),
        ('late', 'Coming late to class'),
        ('behavior', 'Behavior issue'),
        ('other', 'Other reason'),
    ]

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='fines',
        limit_choices_to={'is_teacher': False}
    )
    fine_type = models.ForeignKey(
        AutomaticFine,
        on_delete=models.PROTECT,
        related_name='applied_fines',
        help_text="Type of fine from AutomaticFine definitions"
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_fines'
    )

    # Fine details
    amount = models.BigIntegerField(
        help_text="Fine amount in tiyin"
    )
    reason = models.CharField(
        max_length=20,
        choices=FINE_REASONS,
        default='absence'
    )
    description = models.TextField(
        blank=True,
        help_text="Additional details about the fine"
    )

    # Payment tracking
    is_paid = models.BooleanField(
        default=False,
        help_text="Has this fine been paid?"
    )
    paid_date = models.DateField(
        null=True,
        blank=True
    )

    # Source tracking (what triggered this fine)
    attendance = models.ForeignKey(
        Attendance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fines',
        help_text="Attendance record that triggered this fine (if applicable)"
    )

    # Automatic vs manual
    is_automatic = models.BooleanField(
        default=False,
        help_text="Was this fine automatically applied?"
    )

    # Metadata
    applied_date = models.DateField(
        default=timezone.now,
        help_text="Date when fine was applied"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fines_created',
        limit_choices_to={'is_staff': True},
        help_text="Admin/teacher who created this fine (if manual)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-applied_date']
        verbose_name = "Student Fine"
        verbose_name_plural = "Student Fines"

    def __str__(self):
        return f"{self.student.username} - {self.fine_type.name} - {self.amount / 100} UZS"

    @property
    def amount_in_sum(self):
        """Return amount in sum (UZS) instead of tiyin"""
        return self.amount / 100

    def mark_as_paid(self, paid_date=None):
        """Mark this fine as paid"""
        self.is_paid = True
        self.paid_date = paid_date or timezone.now().date()
        self.save(update_fields=['is_paid', 'paid_date', 'updated_at'])


class AccountTransaction(models.Model):
    """
    Complete audit trail for all financial transactions.
    Automatically created for payments, expenses, teacher earnings, fines, and refunds.
    """
    TRANSACTION_TYPES = [
        ('payment', 'Student Payment'),
        ('expense', 'Expense'),
        ('teacher_earning', 'Teacher Earning'),
        ('fine', 'Student Fine'),
        ('refund', 'Refund'),
        ('adjustment', 'Balance Adjustment'),
        ('monthly_fee', 'Monthly Fee'),
    ]

    TRANSACTION_STATUS = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    ]

    # Transaction identification
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        db_index=True,
        help_text="Type of financial transaction"
    )
    transaction_id = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique transaction identifier"
    )

    # Related objects (nullable for flexibility)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions'
    )
    student = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
        help_text="Student involved in transaction"
    )
    teacher = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teacher_transactions',
        limit_choices_to={'is_teacher': True},
        help_text="Teacher involved in transaction"
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions'
    )

    # Financial details
    amount = models.BigIntegerField(
        help_text="Transaction amount in tiyin (positive = income, negative = expense)"
    )
    balance_before = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Balance before transaction (if applicable)"
    )
    balance_after = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Balance after transaction (if applicable)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=TRANSACTION_STATUS,
        default='completed',
        db_index=True
    )

    # Transaction metadata
    description = models.TextField(
        blank=True,
        help_text="Description of the transaction"
    )
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="External reference number (e.g., receipt number)"
    )

    # Audit fields
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions_created',
        help_text="User who initiated this transaction"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )
    transaction_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date of the transaction"
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Account Transaction"
        verbose_name_plural = "Account Transactions"
        indexes = [
            models.Index(fields=['-transaction_date', 'transaction_type']),
            models.Index(fields=['student', '-transaction_date']),
            models.Index(fields=['teacher', '-transaction_date']),
        ]

    def __str__(self):
        return f"{self.transaction_type} - {self.amount / 100} UZS - {self.transaction_date}"

    @property
    def amount_in_sum(self):
        """Return amount in sum (UZS) instead of tiyin"""
        return self.amount / 100

    @classmethod
    def create_from_payment(cls, payment):
        """Create transaction record from payment"""
        balance = None
        balance_before = None
        balance_after = None

        if payment.by_user and payment.group:
            try:
                balance = StudentBalance.objects.get(
                    student=payment.by_user,
                    group=payment.group
                )
                balance_after = balance.balance
                balance_before = balance_after + payment.amount
            except StudentBalance.DoesNotExist:
                pass

        return cls.objects.create(
            transaction_type='payment',
            transaction_id=f"PAY-{payment.id}-{timezone.now().timestamp()}",
            payment=payment,
            student=payment.by_user,
            group=payment.group,
            amount=payment.amount,
            balance_before=balance_before,
            balance_after=balance_after,
            status='completed' if payment.status == 'paid' else 'pending',
            description=f"Payment from {payment.by_user.username if payment.by_user else 'Unknown'} for {payment.group.name if payment.group else 'Unknown'}",
            reference_number=payment.receipt_number if hasattr(payment, 'receipt_number') else '',
            transaction_date=payment.date,
            created_by=payment.by_user
        )

    @classmethod
    def create_from_fine(cls, fine):
        """Create transaction record from fine"""
        balance = None
        balance_before = None
        balance_after = None

        if fine.student and fine.group:
            try:
                balance = StudentBalance.objects.get(
                    student=fine.student,
                    group=fine.group
                )
                balance_after = balance.balance
                balance_before = balance_after - fine.amount
            except StudentBalance.DoesNotExist:
                pass

        return cls.objects.create(
            transaction_type='fine',
            transaction_id=f"FINE-{fine.id}-{timezone.now().timestamp()}",
            student=fine.student,
            group=fine.group,
            amount=-fine.amount,  # Negative because it increases debt
            balance_before=balance_before,
            balance_after=balance_after,
            status='completed',
            description=f"Fine for {fine.reason}: {fine.fine_type.name}",
            transaction_date=fine.applied_date,
            created_by=fine.created_by
        )

    @classmethod
    def create_from_teacher_earning(cls, earning):
        """Create transaction record from teacher earning"""
        return cls.objects.create(
            transaction_type='teacher_earning',
            transaction_id=f"EARN-{earning.id}-{timezone.now().timestamp()}",
            payment=earning.payment,
            teacher=earning.teacher,
            group=earning.group,
            amount=-earning.amount,  # Negative because it's an expense
            status='completed' if earning.is_paid_to_teacher else 'pending',
            description=f"Teacher earning ({earning.percentage_applied}%) from payment",
            transaction_date=earning.date,
            created_by=None
        )

    @classmethod
    def create_from_monthly_fee(cls, student, group, amount, fee_date):
        """Create transaction record for a monthly fee"""
        balance = None
        balance_before = None
        balance_after = None

        if student and group:
            try:
                balance = StudentBalance.objects.get(
                    student=student,
                    group=group
                )
                balance_before = balance.balance
                balance.add_charge(amount)
                balance_after = balance.balance
            except StudentBalance.DoesNotExist:
                pass

        return cls.objects.create(
            transaction_type='monthly_fee',
            transaction_id=f"FEE-{group.id}-{student.id}-{fee_date.strftime('%Y%m%d')}",
            student=student,
            group=group,
            amount=-amount,  # Negative, like a fine
            balance_before=balance_before,
            balance_after=balance_after,
            status='completed',
            description=f"Monthly fee for {group.name}",
            transaction_date=fee_date,
        )


class FinancialSummary(models.Model):
    """
    Daily financial summary for accounting and reporting.
    Can be calculated automatically via management command or Celery task.
    """
    date = models.DateField(
        unique=True,
        help_text="Date of this financial summary"
    )
    branch = models.ForeignKey(
        'Branch',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='financial_summaries',
        help_text="Branch-specific summary (null = all branches)"
    )

    # Revenue
    total_payments = models.BigIntegerField(
        default=0,
        help_text="Total payments received in tiyin"
    )
    payment_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of payments received"
    )

    # Expenses
    total_expenses = models.BigIntegerField(
        default=0,
        help_text="Total expenses in tiyin"
    )
    expense_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of expense records"
    )

    # Teacher salaries
    total_teacher_earnings = models.BigIntegerField(
        default=0,
        help_text="Total teacher earnings generated in tiyin"
    )
    teacher_earnings_paid = models.BigIntegerField(
        default=0,
        help_text="Total teacher earnings already paid in tiyin"
    )

    # Fines
    total_fines = models.BigIntegerField(
        default=0,
        help_text="Total fines applied in tiyin"
    )
    fines_paid = models.BigIntegerField(
        default=0,
        help_text="Total fines paid in tiyin"
    )

    # Profit/Loss calculation
    gross_revenue = models.BigIntegerField(
        default=0,
        help_text="Payments + Fines paid"
    )
    net_profit = models.BigIntegerField(
        default=0,
        help_text="Revenue - Expenses - Teacher Earnings"
    )

    # Metadata
    calculated_at = models.DateTimeField(
        auto_now=True,
        help_text="When this summary was last calculated"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name = "Financial Summary"
        verbose_name_plural = "Financial Summaries"

    def __str__(self):
        branch_name = self.branch.name if self.branch else "All Branches"
        return f"{branch_name} - {self.date} - Profit: {self.net_profit / 100} UZS"

    @property
    def net_profit_in_sum(self):
        """Return net profit in sum (UZS)"""
        return self.net_profit / 100

    @property
    def total_payments_in_sum(self):
        """Return total payments in sum (UZS)"""
        return self.total_payments / 100

    def calculate(self):
        """
        Recalculate all financial metrics for this date.
        """
        from .models import Expense

        # Get payments for this date
        payments = Payment.objects.filter(
            date=self.date,
            status='paid'
        )
        if self.branch:
            payments = payments.filter(group__branch=self.branch)

        self.total_payments = sum(p.amount for p in payments)
        self.payment_count = payments.count()

        # Get expenses for this date
        expenses = Expense.objects.filter(date=self.date)
        if self.branch:
            expenses = expenses.filter(created_by__branch=self.branch)

        self.total_expenses = sum(e.amount for e in expenses)
        self.expense_count = expenses.count()

        # Get teacher earnings for this date
        earnings = TeacherEarnings.objects.filter(date=self.date)
        if self.branch:
            earnings = earnings.filter(group__branch=self.branch)

        self.total_teacher_earnings = sum(e.amount for e in earnings)
        self.teacher_earnings_paid = sum(
            e.amount for e in earnings if e.is_paid_to_teacher
        )

        # Get fines for this date
        fines = StudentFine.objects.filter(applied_date=self.date)
        if self.branch:
            fines = fines.filter(group__branch=self.branch)

        self.total_fines = sum(f.amount for f in fines)
        self.fines_paid = sum(f.amount for f in fines if f.is_paid)

        # Calculate profit/loss
        self.gross_revenue = self.total_payments + self.fines_paid
        self.net_profit = (
            self.gross_revenue
            - self.total_expenses
            - self.total_teacher_earnings
        )

        self.save()


class MonthlyFeeLog(models.Model):
    """
    Logs which month/year's fees have been successfully processed.
    Ensures that the monthly fee task is idempotent and can self-heal.
    """
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()
    fees_applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['year', 'month']
        verbose_name = "Monthly Fee Log"
        verbose_name_plural = "Monthly Fee Logs"

    def __str__(self):
        return f"Fees applied for {self.month}/{self.year}"

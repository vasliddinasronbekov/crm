"""
Subscription & Payment Models

Features:
- Subscription Plans & Tiers
- Stripe Integration
- Local Payments (Payme, Click)
- Revenue Tracking
- Invoice Management
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from datetime import timedelta
from users.models import User


# ==================== Subscription Plans ====================

class SubscriptionPlan(models.Model):
    """Subscription tier/plan"""
    INTERVAL_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
        ('lifetime', 'Lifetime'),
    ]

    name = models.CharField(max_length=100, help_text="Plan name (e.g., Basic, Pro, Enterprise)")
    slug = models.SlugField(unique=True)
    description = models.TextField()

    # Pricing
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='USD', help_text="USD, UZS")
    interval = models.CharField(max_length=20, choices=INTERVAL_CHOICES, default='monthly')

    # Trial
    trial_period_days = models.IntegerField(default=0, help_text="Free trial days")

    # Features (JSON for flexibility)
    features = models.JSONField(default=dict, help_text="Plan features as JSON")
    # Example: {"max_courses": 10, "max_students": 100, "ai_features": true}

    # Limits
    max_users = models.IntegerField(null=True, blank=True, help_text="Max users allowed (null = unlimited)")
    max_courses = models.IntegerField(null=True, blank=True)
    max_storage_gb = models.IntegerField(null=True, blank=True)

    # Stripe Integration
    stripe_price_id = models.CharField(max_length=255, blank=True, help_text="Stripe Price ID")
    stripe_product_id = models.CharField(max_length=255, blank=True, help_text="Stripe Product ID")

    # Status
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'price']

    def __str__(self):
        return f"{self.name} - {self.price} {self.currency}/{self.interval}"

    @property
    def monthly_price(self):
        """Convert price to monthly equivalent"""
        if self.interval == 'monthly':
            return self.price
        elif self.interval == 'quarterly':
            return self.price / 3
        elif self.interval == 'yearly':
            return self.price / 12
        return self.price


class UserSubscription(models.Model):
    """User's active subscription"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past Due'),
        ('canceled', 'Canceled'),
        ('expired', 'Expired'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trialing')

    # Dates
    start_date = models.DateTimeField(default=timezone.now)
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField()
    canceled_at = models.DateTimeField(null=True, blank=True)

    # Auto-renewal
    auto_renew = models.BooleanField(default=True)
    cancel_at_period_end = models.BooleanField(default=False)

    # Stripe Integration
    stripe_subscription_id = models.CharField(max_length=255, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['current_period_end']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.plan.name} ({self.status})"

    @property
    def is_active(self):
        """Check if subscription is currently active"""
        return self.status in ['active', 'trialing'] and self.current_period_end > timezone.now()

    @property
    def days_until_renewal(self):
        """Days until next renewal"""
        if self.current_period_end:
            delta = self.current_period_end - timezone.now()
            return max(0, delta.days)
        return 0

    @property
    def is_trial(self):
        """Check if in trial period"""
        return self.status == 'trialing' and self.trial_end and self.trial_end > timezone.now()

    def cancel(self, immediate=False):
        """Cancel subscription"""
        if immediate:
            self.status = 'canceled'
            self.canceled_at = timezone.now()
            self.current_period_end = timezone.now()
        else:
            self.cancel_at_period_end = True
        self.save()

    def renew(self):
        """Renew subscription for another period"""
        if self.plan.interval == 'monthly':
            self.current_period_end += timedelta(days=30)
        elif self.plan.interval == 'quarterly':
            self.current_period_end += timedelta(days=90)
        elif self.plan.interval == 'yearly':
            self.current_period_end += timedelta(days=365)

        self.current_period_start = timezone.now()
        self.status = 'active'
        self.save()


# ==================== Payments ====================

class Payment(models.Model):
    """Payment transaction record"""
    PAYMENT_METHOD_CHOICES = [
        ('stripe_card', 'Stripe Card'),
        ('stripe_bank', 'Stripe Bank Transfer'),
        ('paypal', 'PayPal'),
        ('payme', 'Payme'),
        ('click', 'Click'),
        ('yandex', 'Yandex.Kassa / YooMoney'),
        ('alipay', 'Alipay'),
        ('wechat', 'WeChat Pay'),
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('canceled', 'Canceled'),
    ]

    # User & Subscription
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')

    # Amount
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='USD')

    # Payment Info
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # External IDs
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    payme_transaction_id = models.CharField(max_length=255, blank=True)
    click_transaction_id = models.CharField(max_length=255, blank=True)

    # Additional Info
    description = models.TextField(blank=True)
    receipt_url = models.URLField(blank=True)
    failure_reason = models.TextField(blank=True)

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    succeeded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"Payment #{self.id} - {self.user.get_full_name()} - {self.amount} {self.currency} ({self.status})"

    @property
    def is_successful(self):
        return self.status == 'succeeded'

    def mark_succeeded(self):
        """Mark payment as successful"""
        self.status = 'succeeded'
        self.succeeded_at = timezone.now()
        self.save()

    def mark_failed(self, reason=""):
        """Mark payment as failed"""
        self.status = 'failed'
        self.failure_reason = reason
        self.save()


class Invoice(models.Model):
    """Invoice for subscription payments"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('paid', 'Paid'),
        ('void', 'Void'),
        ('uncollectible', 'Uncollectible'),
    ]

    # User & Subscription
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    payment = models.OneToOneField(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice')

    # Invoice Details
    invoice_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # Amounts
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Line Items (JSON for flexibility)
    line_items = models.JSONField(default=list, help_text="Invoice line items")
    # Example: [{"description": "Pro Plan - Monthly", "amount": 29.99, "quantity": 1}]

    # Dates
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)

    # Stripe
    stripe_invoice_id = models.CharField(max_length=255, blank=True)

    # PDF
    pdf_url = models.URLField(blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.user.get_full_name()} - {self.total} {self.currency}"

    def mark_paid(self):
        """Mark invoice as paid"""
        self.status = 'paid'
        self.paid_at = timezone.now()
        self.save()

    @classmethod
    def generate_invoice_number(cls):
        """Generate unique invoice number"""
        from datetime import datetime
        prefix = datetime.now().strftime('%Y%m')
        last_invoice = cls.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').first()

        if last_invoice:
            last_number = int(last_invoice.invoice_number[-4:])
            new_number = last_number + 1
        else:
            new_number = 1

        return f"{prefix}{new_number:04d}"


# ==================== Payment Methods ====================

class PaymentMethod(models.Model):
    """Stored payment method for user"""
    METHOD_TYPE_CHOICES = [
        ('card', 'Credit/Debit Card'),
        ('bank_account', 'Bank Account'),
        ('payme', 'Payme'),
        ('click', 'Click'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_methods')
    method_type = models.CharField(max_length=20, choices=METHOD_TYPE_CHOICES)

    # For Cards
    card_last4 = models.CharField(max_length=4, blank=True)
    card_brand = models.CharField(max_length=20, blank=True, help_text="visa, mastercard, etc.")
    card_exp_month = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(12)])
    card_exp_year = models.IntegerField(null=True, blank=True)

    # For Bank Accounts
    bank_name = models.CharField(max_length=100, blank=True)
    account_last4 = models.CharField(max_length=4, blank=True)

    # External IDs
    stripe_payment_method_id = models.CharField(max_length=255, blank=True)

    # Status
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        if self.method_type == 'card':
            return f"{self.card_brand} ****{self.card_last4}"
        elif self.method_type == 'bank_account':
            return f"{self.bank_name} ****{self.account_last4}"
        return f"{self.get_method_type_display()}"

    def save(self, *args, **kwargs):
        # If this is default, unset other defaults
        if self.is_default:
            PaymentMethod.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)


# ==================== Coupons & Discounts ====================

class Coupon(models.Model):
    """Discount coupon"""
    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)

    # Discount
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Percentage (0-100) or fixed amount")
    currency = models.CharField(max_length=3, default='USD', blank=True)

    # Restrictions
    max_redemptions = models.IntegerField(null=True, blank=True, help_text="Null = unlimited")
    redemptions_count = models.IntegerField(default=0)
    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Validity
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)

    # Plan restrictions
    applicable_plans = models.ManyToManyField(SubscriptionPlan, blank=True, help_text="Leave empty for all plans")

    # Status
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.discount_value}{'%' if self.discount_type == 'percentage' else self.currency}"

    def is_valid(self):
        """Check if coupon is valid"""
        now = timezone.now()

        # Check active
        if not self.is_active:
            return False, "Coupon is inactive"

        # Check date range
        if self.valid_until and now > self.valid_until:
            return False, "Coupon has expired"

        if now < self.valid_from:
            return False, "Coupon is not yet valid"

        # Check redemptions
        if self.max_redemptions and self.redemptions_count >= self.max_redemptions:
            return False, "Coupon has reached maximum redemptions"

        return True, "Valid"

    def calculate_discount(self, amount):
        """Calculate discount amount"""
        if self.discount_type == 'percentage':
            return (amount * self.discount_value) / 100
        else:
            return min(self.discount_value, amount)  # Don't exceed original amount


class CouponUsage(models.Model):
    """Track coupon usage"""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coupon_usages')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.SET_NULL, null=True, blank=True)
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True)

    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    original_amount = models.DecimalField(max_digits=10, decimal_places=2)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2)

    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-used_at']

    def __str__(self):
        return f"{self.coupon.code} used by {self.user.get_full_name()}"


# ==================== Revenue Tracking ====================

class RevenueRecord(models.Model):
    """Track revenue for analytics"""
    REVENUE_TYPE_CHOICES = [
        ('subscription', 'Subscription'),
        ('one_time', 'One-time Payment'),
        ('refund', 'Refund'),
    ]

    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name='revenue_record')
    revenue_type = models.CharField(max_length=20, choices=REVENUE_TYPE_CHOICES)

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Breakdown
    gross_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Before fees")
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Payment processing fees")
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="After fees")

    # Date tracking (for monthly/yearly reports)
    revenue_date = models.DateField(default=timezone.now)
    revenue_month = models.IntegerField()  # 1-12
    revenue_year = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-revenue_date']
        indexes = [
            models.Index(fields=['revenue_year', 'revenue_month']),
            models.Index(fields=['-revenue_date']),
        ]

    def __str__(self):
        return f"Revenue: {self.amount} {self.currency} on {self.revenue_date}"

    def save(self, *args, **kwargs):
        # Auto-set month and year
        if not self.revenue_month:
            self.revenue_month = self.revenue_date.month
        if not self.revenue_year:
            self.revenue_year = self.revenue_date.year
        super().save(*args, **kwargs)

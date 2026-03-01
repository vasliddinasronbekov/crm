"""
Affiliate Program Models

Track referrals, commissions, and payouts for affiliate marketing.
Users can refer others and earn commissions on their purchases.
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
import secrets
from users.models import User


# ==================== Affiliate Profile ====================

class AffiliateProfile(models.Model):
    """
    Affiliate/referrer profile
    Anyone can become an affiliate and earn commissions
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('banned', 'Banned'),
    ]

    TIER_CHOICES = [
        ('bronze', 'Bronze - 10% commission'),
        ('silver', 'Silver - 15% commission'),
        ('gold', 'Gold - 20% commission'),
        ('platinum', 'Platinum - 25% commission'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='affiliate_profile')

    # Referral Code
    referral_code = models.CharField(max_length=50, unique=True, db_index=True)
    vanity_code = models.CharField(max_length=50, unique=True, blank=True, null=True, help_text="Custom referral code")

    # Tier & Commission
    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='bronze')
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('10.00'),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Commission percentage"
    )
    custom_commission = models.BooleanField(default=False, help_text="Has custom commission rate")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Payout Info
    payout_method = models.CharField(max_length=50, blank=True, help_text="PayPal, Bank, etc.")
    payout_email = models.EmailField(blank=True)
    bank_account_info = models.JSONField(default=dict, blank=True)
    min_payout_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('50.00'),
        help_text="Minimum amount for payout"
    )

    # Statistics
    total_referrals = models.IntegerField(default=0)
    successful_referrals = models.IntegerField(default=0, help_text="Referrals who made a purchase")
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_paid_out = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    pending_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Timestamps
    joined_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_earnings']
        indexes = [
            models.Index(fields=['referral_code']),
            models.Index(fields=['status', '-total_earnings']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.referral_code}"

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()
        super().save(*args, **kwargs)

    @staticmethod
    def generate_referral_code():
        """Generate unique referral code"""
        while True:
            code = secrets.token_urlsafe(8).upper()
            if not AffiliateProfile.objects.filter(referral_code=code).exists():
                return code

    @property
    def available_balance(self):
        """Get available balance for withdrawal"""
        return self.pending_earnings

    def update_tier(self):
        """Auto-update tier based on total earnings"""
        if not self.custom_commission:
            earnings = self.total_earnings

            if earnings >= 10000:
                self.tier = 'platinum'
                self.commission_rate = Decimal('25.00')
            elif earnings >= 5000:
                self.tier = 'gold'
                self.commission_rate = Decimal('20.00')
            elif earnings >= 1000:
                self.tier = 'silver'
                self.commission_rate = Decimal('15.00')
            else:
                self.tier = 'bronze'
                self.commission_rate = Decimal('10.00')

            self.save()


# ==================== Referral ====================

class Referral(models.Model):
    """
    Track individual referrals
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),  # Referred user signed up
        ('converted', 'Converted'),  # Made a purchase
        ('expired', 'Expired'),  # Referral expired without conversion
    ]

    # Referrer & Referred
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='referrals')
    referred_user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_info')

    # Referral Info
    referral_code_used = models.CharField(max_length=50)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.CharField(max_length=500, blank=True)
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Conversion
    converted_at = models.DateTimeField(null=True, blank=True)
    first_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Timestamps
    referred_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-referred_at']
        indexes = [
            models.Index(fields=['affiliate', '-referred_at']),
            models.Index(fields=['status', '-referred_at']),
        ]

    def __str__(self):
        return f"{self.referred_user.get_full_name()} referred by {self.affiliate.user.get_full_name()}"

    def mark_converted(self, purchase_amount):
        """Mark referral as converted"""
        if self.status != 'pending':
            return

        self.status = 'converted'
        self.converted_at = timezone.now()
        self.first_purchase_amount = purchase_amount
        self.save()

        # Update affiliate stats
        self.affiliate.successful_referrals += 1
        self.affiliate.save()


# ==================== Affiliate Commission ====================

class AffiliateCommission(models.Model):
    """
    Individual commission transactions
    """
    TYPE_CHOICES = [
        ('sale', 'Sale Commission'),
        ('subscription', 'Subscription Commission'),
        ('recurring', 'Recurring Commission'),
        ('bonus', 'Bonus'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
    ]

    # Affiliate & Referral
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='commissions')
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name='commissions')

    # Commission Info
    commission_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='sale')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Rate at time of commission")

    # Related Transaction
    purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Original purchase amount")
    subscription = models.ForeignKey('UserSubscription', on_delete=models.SET_NULL, null=True, blank=True)
    payment = models.ForeignKey('Payment', on_delete=models.SET_NULL, null=True, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Payout
    payout = models.ForeignKey('AffiliatePayout', on_delete=models.SET_NULL, null=True, blank=True, related_name='commissions')
    paid_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # Timestamps
    earned_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-earned_at']
        indexes = [
            models.Index(fields=['affiliate', '-earned_at']),
            models.Index(fields=['status', '-earned_at']),
        ]

    def __str__(self):
        return f"{self.affiliate.user.get_full_name()} - {self.amount} {self.currency} ({self.status})"

    def approve(self):
        """Approve commission"""
        if self.status != 'pending':
            return

        self.status = 'approved'
        self.approved_at = timezone.now()
        self.save()

        # Update affiliate earnings
        self.affiliate.total_earnings += self.amount
        self.affiliate.pending_earnings += self.amount
        self.affiliate.save()

        # Check tier upgrade
        self.affiliate.update_tier()

    def reject(self, reason=""):
        """Reject commission"""
        self.status = 'rejected'
        self.rejection_reason = reason
        self.save()


# ==================== Affiliate Payout ====================

class AffiliatePayout(models.Model):
    """
    Batch payouts to affiliates
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Affiliate & Amount
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Payout Method
    payout_method = models.CharField(max_length=50)
    payout_email = models.EmailField(blank=True)
    bank_details = models.JSONField(default=dict, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Transaction IDs
    transaction_id = models.CharField(max_length=255, blank=True)
    external_reference = models.CharField(max_length=255, blank=True)

    # Fees
    processing_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Amount after fees")

    # Period
    period_start = models.DateField()
    period_end = models.DateField()

    # Metadata
    notes = models.TextField(blank=True)
    failure_reason = models.TextField(blank=True)

    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['affiliate', '-requested_at']),
            models.Index(fields=['status', '-requested_at']),
        ]

    def __str__(self):
        return f"Payout to {self.affiliate.user.get_full_name()}: {self.amount} {self.currency}"

    def mark_completed(self, transaction_id=""):
        """Mark payout as completed"""
        self.status = 'completed'
        self.transaction_id = transaction_id
        self.processed_at = timezone.now()
        self.save()

        # Update affiliate stats
        self.affiliate.total_paid_out += self.amount
        self.affiliate.pending_earnings -= self.amount
        self.affiliate.save()

        # Update commission records
        self.commissions.update(status='paid', paid_at=timezone.now())

    def mark_failed(self, reason=""):
        """Mark payout as failed"""
        self.status = 'failed'
        self.failure_reason = reason
        self.save()


# ==================== Referral Click Tracking ====================

class ReferralClick(models.Model):
    """
    Track clicks on referral links for analytics
    """
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='clicks')
    referral_code = models.CharField(max_length=50, db_index=True)

    # Visitor Info
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.CharField(max_length=500, blank=True)
    referer = models.URLField(blank=True)

    # UTM Parameters
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    utm_term = models.CharField(max_length=100, blank=True)
    utm_content = models.CharField(max_length=100, blank=True)

    # Conversion
    converted = models.BooleanField(default=False)
    converted_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # Timestamp
    clicked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-clicked_at']
        indexes = [
            models.Index(fields=['affiliate', '-clicked_at']),
            models.Index(fields=['referral_code', '-clicked_at']),
        ]

    def __str__(self):
        return f"Click on {self.referral_code} at {self.clicked_at}"


# ==================== Affiliate Campaign ====================

class AffiliateCampaign(models.Model):
    """
    Special affiliate campaigns with custom terms
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField()

    # Campaign Settings
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Special commission rate for this campaign"
    )
    bonus_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Bonus per conversion"
    )

    # Eligibility
    eligible_affiliates = models.ManyToManyField(AffiliateProfile, blank=True, related_name='campaigns')
    min_tier = models.CharField(max_length=20, blank=True, help_text="Minimum tier required")

    # Target Products
    applicable_plans = models.ManyToManyField('SubscriptionPlan', blank=True)

    # Dates
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    # Status
    is_active = models.BooleanField(default=True)

    # Statistics
    total_clicks = models.IntegerField(default=0)
    total_conversions = models.IntegerField(default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def is_running(self):
        """Check if campaign is currently running"""
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

"""
Marketplace Platform Models

Two-sided marketplace for content creators and students.
Creators can upload courses, set pricing, and earn revenue.
Platform takes 30% commission.
"""

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from users.models import User


# ==================== Content Creator Profile ====================

class ContentCreator(models.Model):
    """
    Content creator profile for teachers/instructors
    who want to sell courses on the platform
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('banned', 'Banned'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='creator_profile')

    # Profile Info
    display_name = models.CharField(max_length=200)
    bio = models.TextField(blank=True)
    expertise = models.JSONField(default=list, help_text="Areas of expertise")
    profile_image = models.URLField(blank=True)
    banner_image = models.URLField(blank=True)

    # Contact & Social
    website = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    twitter = models.URLField(blank=True)
    youtube = models.URLField(blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    verified = models.BooleanField(default=False, help_text="Verified creator badge")

    # Revenue Share
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('30.00'),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Platform commission percentage (default: 30%)"
    )

    # Payout Info
    payout_method = models.CharField(max_length=50, blank=True, help_text="PayPal, Bank, etc.")
    payout_email = models.EmailField(blank=True)
    bank_account_info = models.JSONField(default=dict, blank=True)

    # Statistics
    total_students = models.IntegerField(default=0)
    total_courses = models.IntegerField(default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    # Timestamps
    applied_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['-total_revenue']),
        ]

    def __str__(self):
        return f"{self.display_name} (@{self.user.email})"

    def approve(self):
        """Approve creator application"""
        self.status = 'active'
        self.approved_at = timezone.now()
        self.save()

    @property
    def creator_share_percentage(self):
        """Creator's revenue share (100 - commission)"""
        return Decimal('100.00') - self.commission_rate


# ==================== Creator Course ====================

class CreatorCourse(models.Model):
    """
    Courses created and sold by content creators on the marketplace
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    PRICING_MODEL_CHOICES = [
        ('one_time', 'One-time Purchase'),
        ('subscription', 'Subscription-based'),
        ('free', 'Free'),
    ]

    # Creator & Basic Info
    creator = models.ForeignKey(ContentCreator, on_delete=models.CASCADE, related_name='courses')
    title = models.CharField(max_length=300)
    slug = models.SlugField(max_length=350, unique=True)
    description = models.TextField()
    short_description = models.CharField(max_length=500, blank=True)

    # Media
    thumbnail = models.URLField(blank=True)
    preview_video = models.URLField(blank=True)

    # Pricing
    pricing_model = models.CharField(max_length=20, choices=PRICING_MODEL_CHOICES, default='one_time')
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Course price (0 for free courses)"
    )
    currency = models.CharField(max_length=3, default='USD')
    discount_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Discounted price (optional)"
    )

    # Course Details
    level = models.CharField(max_length=50, blank=True, help_text="Beginner, Intermediate, Advanced")
    language = models.CharField(max_length=50, default='English')
    duration_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0, help_text="Total course duration in hours")
    total_lectures = models.IntegerField(default=0)
    total_quizzes = models.IntegerField(default=0)

    # Features
    has_certificate = models.BooleanField(default=True)
    has_lifetime_access = models.BooleanField(default=True)
    has_money_back_guarantee = models.BooleanField(default=False)
    money_back_days = models.IntegerField(default=30, help_text="Money-back guarantee period in days")

    # Requirements & Outcomes
    requirements = models.JSONField(default=list, help_text="Course prerequisites")
    learning_outcomes = models.JSONField(default=list, help_text="What students will learn")
    target_audience = models.JSONField(default=list, help_text="Who this course is for")

    # Status & Visibility
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)

    # Statistics
    total_students = models.IntegerField(default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.IntegerField(default=0)

    # Timestamps
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['creator', 'status']),
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['-total_students']),
            models.Index(fields=['-total_revenue']),
        ]

    def __str__(self):
        return f"{self.title} by {self.creator.display_name}"

    @property
    def effective_price(self):
        """Get current effective price (considering discounts)"""
        if self.discount_price and self.discount_price < self.price:
            return self.discount_price
        return self.price

    @property
    def creator_earnings_per_sale(self):
        """Calculate creator's earnings per sale"""
        platform_commission = (self.effective_price * self.creator.commission_rate) / 100
        return self.effective_price - platform_commission

    @property
    def platform_earnings_per_sale(self):
        """Calculate platform's earnings per sale"""
        return (self.effective_price * self.creator.commission_rate) / 100

    def publish(self):
        """Publish course"""
        self.status = 'published'
        self.published_at = timezone.now()
        self.save()


# ==================== Course Purchase ====================

class CoursePurchase(models.Model):
    """
    Track course purchases from marketplace
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('refunded', 'Refunded'),
    ]

    # Purchase Info
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_purchases')
    course = models.ForeignKey(CreatorCourse, on_delete=models.CASCADE, related_name='purchases')
    creator = models.ForeignKey(ContentCreator, on_delete=models.CASCADE, related_name='sales')

    # Payment
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    payment = models.ForeignKey('Payment', on_delete=models.SET_NULL, null=True, blank=True)

    # Revenue Split
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Platform's commission")
    creator_earnings = models.DecimalField(max_digits=10, decimal_places=2, help_text="Creator's share")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Commission % at time of purchase")

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Refund
    refunded_at = models.DateTimeField(null=True, blank=True)
    refund_reason = models.TextField(blank=True)

    # Gift
    is_gift = models.BooleanField(default=False)
    gifted_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='gifted_courses')

    # Timestamps
    purchased_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-purchased_at']
        unique_together = ['student', 'course']  # One purchase per student per course
        indexes = [
            models.Index(fields=['student', '-purchased_at']),
            models.Index(fields=['creator', '-purchased_at']),
            models.Index(fields=['course', '-purchased_at']),
            models.Index(fields=['status', '-purchased_at']),
        ]

    def __str__(self):
        return f"{self.student.get_full_name()} purchased {self.course.title}"

    def complete(self):
        """Mark purchase as completed"""
        self.status = 'completed'
        self.save()

        # Update statistics
        self.course.total_students += 1
        self.course.total_revenue += self.amount_paid
        self.course.save()

        self.creator.total_students += 1
        self.creator.total_revenue += self.creator_earnings
        self.creator.save()

    def refund(self, reason=""):
        """Process refund"""
        self.status = 'refunded'
        self.refunded_at = timezone.now()
        self.refund_reason = reason
        self.save()

        # Update statistics
        self.course.total_students = max(0, self.course.total_students - 1)
        self.course.total_revenue = max(0, self.course.total_revenue - self.amount_paid)
        self.course.save()

        self.creator.total_students = max(0, self.creator.total_students - 1)
        self.creator.total_revenue = max(0, self.creator.total_revenue - self.creator_earnings)
        self.creator.save()


# ==================== Creator Earnings & Payouts ====================

class CreatorEarnings(models.Model):
    """
    Track individual earnings transactions for creators
    """
    creator = models.ForeignKey(ContentCreator, on_delete=models.CASCADE, related_name='earnings')
    purchase = models.OneToOneField(CoursePurchase, on_delete=models.CASCADE, related_name='earnings_record')

    # Earnings
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Creator's earnings from this sale")
    currency = models.CharField(max_length=3, default='USD')

    # Payout Status
    is_paid_out = models.BooleanField(default=False)
    payout = models.ForeignKey('CreatorPayout', on_delete=models.SET_NULL, null=True, blank=True, related_name='earnings')

    # Timestamps
    earned_at = models.DateTimeField(auto_now_add=True)
    paid_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-earned_at']
        indexes = [
            models.Index(fields=['creator', '-earned_at']),
            models.Index(fields=['is_paid_out', '-earned_at']),
        ]

    def __str__(self):
        return f"{self.creator.display_name} earned {self.amount} {self.currency}"


class CreatorPayout(models.Model):
    """
    Batch payouts to creators (weekly/monthly)
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Creator & Amount
    creator = models.ForeignKey(ContentCreator, on_delete=models.CASCADE, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Payout Method
    payout_method = models.CharField(max_length=50, help_text="PayPal, Bank Transfer, etc.")
    payout_email = models.EmailField(blank=True)
    bank_details = models.JSONField(default=dict, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Transaction IDs
    transaction_id = models.CharField(max_length=255, blank=True)
    external_reference = models.CharField(max_length=255, blank=True)

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
            models.Index(fields=['creator', '-requested_at']),
            models.Index(fields=['status', '-requested_at']),
        ]

    def __str__(self):
        return f"Payout to {self.creator.display_name}: {self.amount} {self.currency} ({self.status})"

    def mark_completed(self, transaction_id=""):
        """Mark payout as completed"""
        self.status = 'completed'
        self.transaction_id = transaction_id
        self.processed_at = timezone.now()
        self.save()

        # Update earnings records
        self.earnings.update(is_paid_out=True, paid_out_at=timezone.now())

    def mark_failed(self, reason=""):
        """Mark payout as failed"""
        self.status = 'failed'
        self.failure_reason = reason
        self.save()


# ==================== Course Reviews ====================

class CourseReview(models.Model):
    """
    Student reviews for marketplace courses
    """
    # Review Info
    course = models.ForeignKey(CreatorCourse, on_delete=models.CASCADE, related_name='reviews')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_reviews')
    purchase = models.OneToOneField(CoursePurchase, on_delete=models.CASCADE, related_name='review')

    # Rating & Review
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=200, blank=True)
    review_text = models.TextField()

    # Helpful votes
    helpful_count = models.IntegerField(default=0)

    # Status
    is_verified_purchase = models.BooleanField(default=True)
    is_published = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['course', 'student']
        indexes = [
            models.Index(fields=['course', '-created_at']),
            models.Index(fields=['-helpful_count']),
        ]

    def __str__(self):
        return f"{self.student.get_full_name()} reviewed {self.course.title} ({self.rating}/5)"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # Update course average rating
        from django.db.models import Avg
        avg_rating = self.course.reviews.filter(is_published=True).aggregate(avg=Avg('rating'))['avg']
        if avg_rating:
            self.course.average_rating = avg_rating
            self.course.total_reviews = self.course.reviews.filter(is_published=True).count()
            self.course.save()

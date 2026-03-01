"""
Marketplace Serializers
"""
from rest_framework import serializers
from .marketplace_models import (
    ContentCreator, CreatorCourse, CoursePurchase,
    CreatorEarnings, CreatorPayout, CourseReview
)
from users.serializers import UserSerializer


class ContentCreatorSerializer(serializers.ModelSerializer):
    """Content creator profile serializer"""
    user = UserSerializer(read_only=True)
    creator_share_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = ContentCreator
        fields = [
            'id', 'user', 'display_name', 'bio', 'expertise',
            'profile_image', 'banner_image', 'website', 'linkedin',
            'twitter', 'youtube', 'status', 'verified',
            'commission_rate', 'creator_share_percentage',
            'total_students', 'total_courses', 'total_revenue',
            'average_rating', 'applied_at', 'approved_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'status', 'verified', 'total_students', 'total_courses',
            'total_revenue', 'average_rating', 'applied_at', 'approved_at'
        ]


class ContentCreatorListSerializer(serializers.ModelSerializer):
    """Simplified creator list view"""
    class Meta:
        model = ContentCreator
        fields = [
            'id', 'display_name', 'profile_image', 'verified',
            'total_students', 'total_courses', 'average_rating'
        ]


class CreatorCourseSerializer(serializers.ModelSerializer):
    """Full course details"""
    creator = ContentCreatorListSerializer(read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    creator_earnings_per_sale = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    platform_earnings_per_sale = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CreatorCourse
        fields = [
            'id', 'creator', 'title', 'slug', 'description', 'short_description',
            'thumbnail', 'preview_video', 'pricing_model', 'price', 'currency',
            'discount_price', 'effective_price', 'level', 'language',
            'duration_hours', 'total_lectures', 'total_quizzes',
            'has_certificate', 'has_lifetime_access', 'has_money_back_guarantee',
            'money_back_days', 'requirements', 'learning_outcomes', 'target_audience',
            'status', 'is_featured', 'total_students', 'total_revenue',
            'average_rating', 'total_reviews', 'published_at', 'created_at',
            'updated_at', 'creator_earnings_per_sale', 'platform_earnings_per_sale'
        ]
        read_only_fields = [
            'slug', 'total_students', 'total_revenue', 'average_rating',
            'total_reviews', 'published_at'
        ]


class CreatorCourseListSerializer(serializers.ModelSerializer):
    """Simplified course list view"""
    creator_name = serializers.CharField(source='creator.display_name', read_only=True)
    creator_verified = serializers.BooleanField(source='creator.verified', read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CreatorCourse
        fields = [
            'id', 'title', 'slug', 'short_description', 'thumbnail',
            'creator_name', 'creator_verified', 'price', 'discount_price',
            'effective_price', 'currency', 'level', 'language',
            'duration_hours', 'total_students', 'average_rating',
            'total_reviews', 'is_featured', 'published_at'
        ]


class CreatorCourseCreateSerializer(serializers.ModelSerializer):
    """Course creation serializer"""
    class Meta:
        model = CreatorCourse
        fields = [
            'title', 'description', 'short_description', 'thumbnail',
            'preview_video', 'pricing_model', 'price', 'currency',
            'discount_price', 'level', 'language', 'duration_hours',
            'total_lectures', 'total_quizzes', 'has_certificate',
            'has_lifetime_access', 'has_money_back_guarantee',
            'money_back_days', 'requirements', 'learning_outcomes',
            'target_audience'
        ]


class CoursePurchaseSerializer(serializers.ModelSerializer):
    """Course purchase serializer"""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    creator_name = serializers.CharField(source='creator.display_name', read_only=True)

    class Meta:
        model = CoursePurchase
        fields = [
            'id', 'student', 'student_name', 'course', 'course_title',
            'creator', 'creator_name', 'amount_paid', 'currency',
            'platform_fee', 'creator_earnings', 'commission_rate',
            'status', 'is_gift', 'gifted_to', 'purchased_at',
            'refunded_at', 'refund_reason'
        ]
        read_only_fields = [
            'platform_fee', 'creator_earnings', 'commission_rate',
            'purchased_at', 'refunded_at'
        ]


class CreatorEarningsSerializer(serializers.ModelSerializer):
    """Creator earnings serializer"""
    course_title = serializers.CharField(source='purchase.course.title', read_only=True)
    student_name = serializers.CharField(source='purchase.student.get_full_name', read_only=True)

    class Meta:
        model = CreatorEarnings
        fields = [
            'id', 'creator', 'purchase', 'course_title', 'student_name',
            'amount', 'currency', 'is_paid_out', 'payout',
            'earned_at', 'paid_out_at'
        ]
        read_only_fields = ['earned_at', 'paid_out_at']


class CreatorPayoutSerializer(serializers.ModelSerializer):
    """Creator payout serializer"""
    creator_name = serializers.CharField(source='creator.display_name', read_only=True)
    earnings_count = serializers.IntegerField(source='earnings.count', read_only=True)

    class Meta:
        model = CreatorPayout
        fields = [
            'id', 'creator', 'creator_name', 'amount', 'currency',
            'payout_method', 'payout_email', 'status', 'transaction_id',
            'period_start', 'period_end', 'earnings_count', 'notes',
            'failure_reason', 'requested_at', 'processed_at'
        ]
        read_only_fields = ['transaction_id', 'requested_at', 'processed_at']


class CourseReviewSerializer(serializers.ModelSerializer):
    """Course review serializer"""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = CourseReview
        fields = [
            'id', 'course', 'course_title', 'student', 'student_name',
            'rating', 'title', 'review_text', 'helpful_count',
            'is_verified_purchase', 'is_published', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'is_verified_purchase', 'helpful_count', 'created_at', 'updated_at'
        ]


class CourseReviewCreateSerializer(serializers.ModelSerializer):
    """Course review creation serializer"""
    class Meta:
        model = CourseReview
        fields = ['course', 'rating', 'title', 'review_text']


# ==================== Analytics Serializers ====================

class CreatorAnalyticsSerializer(serializers.Serializer):
    """Creator analytics dashboard data"""
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_students = serializers.IntegerField()
    total_courses = serializers.IntegerField()
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2)
    total_reviews = serializers.IntegerField()
    monthly_revenue = serializers.ListField()
    top_courses = CreatorCourseListSerializer(many=True)
    recent_sales = CoursePurchaseSerializer(many=True)


class MarketplaceStatsSerializer(serializers.Serializer):
    """Platform-wide marketplace statistics"""
    total_creators = serializers.IntegerField()
    active_creators = serializers.IntegerField()
    total_marketplace_courses = serializers.IntegerField()
    total_course_sales = serializers.IntegerField()
    total_marketplace_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    platform_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    creator_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_payouts = serializers.DecimalField(max_digits=12, decimal_places=2)
    average_course_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    top_selling_courses = CreatorCourseListSerializer(many=True)
    top_creators = ContentCreatorListSerializer(many=True)

"""
Affiliate Program Serializers
"""
from rest_framework import serializers
from .affiliate_models import (
    AffiliateProfile, Referral, AffiliateCommission,
    AffiliatePayout, ReferralClick, AffiliateCampaign
)
from users.serializers import UserSerializer


class AffiliateProfileSerializer(serializers.ModelSerializer):
    """Affiliate profile serializer"""
    user = UserSerializer(read_only=True)
    available_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    conversion_rate = serializers.SerializerMethodField()

    class Meta:
        model = AffiliateProfile
        fields = [
            'id', 'user', 'referral_code', 'vanity_code', 'tier',
            'commission_rate', 'status', 'payout_method', 'payout_email',
            'min_payout_amount', 'total_referrals', 'successful_referrals',
            'total_earnings', 'total_paid_out', 'pending_earnings',
            'available_balance', 'conversion_rate', 'joined_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'referral_code', 'tier', 'commission_rate', 'status',
            'total_referrals', 'successful_referrals', 'total_earnings',
            'total_paid_out', 'pending_earnings', 'joined_at'
        ]

    def get_conversion_rate(self, obj):
        """Calculate conversion rate"""
        if obj.total_referrals == 0:
            return 0
        return (obj.successful_referrals / obj.total_referrals) * 100


class ReferralSerializer(serializers.ModelSerializer):
    """Referral serializer"""
    referred_user_name = serializers.CharField(source='referred_user.get_full_name', read_only=True)
    referred_user_email = serializers.EmailField(source='referred_user.email', read_only=True)
    affiliate_name = serializers.CharField(source='affiliate.user.get_full_name', read_only=True)

    class Meta:
        model = Referral
        fields = [
            'id', 'affiliate', 'affiliate_name', 'referred_user',
            'referred_user_name', 'referred_user_email', 'referral_code_used',
            'ip_address', 'utm_source', 'utm_medium', 'utm_campaign',
            'status', 'converted_at', 'first_purchase_amount',
            'referred_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'status', 'converted_at', 'first_purchase_amount', 'referred_at'
        ]


class AffiliateCommissionSerializer(serializers.ModelSerializer):
    """Commission serializer"""
    affiliate_name = serializers.CharField(source='affiliate.user.get_full_name', read_only=True)
    referred_user_name = serializers.CharField(source='referral.referred_user.get_full_name', read_only=True)

    class Meta:
        model = AffiliateCommission
        fields = [
            'id', 'affiliate', 'affiliate_name', 'referral', 'referred_user_name',
            'commission_type', 'amount', 'currency', 'commission_rate',
            'purchase_amount', 'subscription', 'payment', 'status',
            'payout', 'paid_at', 'notes', 'rejection_reason',
            'earned_at', 'approved_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'status', 'paid_at', 'earned_at', 'approved_at'
        ]


class AffiliatePayoutSerializer(serializers.ModelSerializer):
    """Payout serializer"""
    affiliate_name = serializers.CharField(source='affiliate.user.get_full_name', read_only=True)
    commissions_count = serializers.IntegerField(source='commissions.count', read_only=True)

    class Meta:
        model = AffiliatePayout
        fields = [
            'id', 'affiliate', 'affiliate_name', 'amount', 'currency',
            'payout_method', 'payout_email', 'status', 'transaction_id',
            'processing_fee', 'net_amount', 'period_start', 'period_end',
            'commissions_count', 'notes', 'failure_reason',
            'requested_at', 'processed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'transaction_id', 'processing_fee', 'net_amount',
            'requested_at', 'processed_at'
        ]


class ReferralClickSerializer(serializers.ModelSerializer):
    """Click tracking serializer"""
    class Meta:
        model = ReferralClick
        fields = [
            'id', 'affiliate', 'referral_code', 'ip_address',
            'user_agent', 'referer', 'utm_source', 'utm_medium',
            'utm_campaign', 'utm_term', 'utm_content',
            'converted', 'converted_user', 'clicked_at'
        ]
        read_only_fields = ['clicked_at']


class AffiliateCampaignSerializer(serializers.ModelSerializer):
    """Campaign serializer"""
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = AffiliateCampaign
        fields = [
            'id', 'name', 'slug', 'description', 'commission_rate',
            'bonus_amount', 'min_tier', 'start_date', 'end_date',
            'is_active', 'is_running', 'total_clicks', 'total_conversions',
            'total_revenue', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'total_clicks', 'total_conversions', 'total_revenue'
        ]


# ==================== Analytics Serializers ====================

class AffiliateAnalyticsSerializer(serializers.Serializer):
    """Affiliate analytics dashboard"""
    total_clicks = serializers.IntegerField()
    total_referrals = serializers.IntegerField()
    successful_referrals = serializers.IntegerField()
    conversion_rate = serializers.FloatField()
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid_out = serializers.DecimalField(max_digits=12, decimal_places=2)
    average_commission = serializers.DecimalField(max_digits=10, decimal_places=2)
    monthly_earnings = serializers.ListField()
    top_referrals = ReferralSerializer(many=True)
    recent_commissions = AffiliateCommissionSerializer(many=True)


class AffiliateStatsSerializer(serializers.Serializer):
    """Platform-wide affiliate statistics"""
    total_affiliates = serializers.IntegerField()
    active_affiliates = serializers.IntegerField()
    total_referrals = serializers.IntegerField()
    total_conversions = serializers.IntegerField()
    overall_conversion_rate = serializers.FloatField()
    total_commissions_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_commissions = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_clicks = serializers.IntegerField()
    top_affiliates = AffiliateProfileSerializer(many=True)

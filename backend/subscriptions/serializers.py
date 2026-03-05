"""
Subscription & Payment Serializers
"""
from typing import Any
from rest_framework import serializers
from decimal import Decimal
from .models import (
    SubscriptionPlan, UserSubscription, Payment, Invoice,
    PaymentMethod, Coupon, CouponUsage, RevenueRecord
)


# ==================== Subscription Plans ====================

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Subscription plan serializer"""
    monthly_price = serializers.ReadOnlyField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'slug', 'description', 'price', 'currency', 'interval',
            'trial_period_days', 'features', 'max_users', 'max_courses', 'max_storage_gb',
            'stripe_price_id', 'stripe_product_id', 'is_active', 'is_featured',
            'display_order', 'monthly_price', 'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']


class SubscriptionPlanListSerializer(serializers.ModelSerializer):
    """Simplified subscription plan list"""
    monthly_price = serializers.ReadOnlyField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'slug', 'description', 'price', 'currency', 'interval',
            'trial_period_days', 'features', 'is_featured', 'monthly_price'
        ]


# ==================== User Subscriptions ====================

class UserSubscriptionSerializer(serializers.ModelSerializer):
    """User subscription serializer"""
    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.IntegerField(write_only=True)
    is_active = serializers.ReadOnlyField()
    days_until_renewal = serializers.ReadOnlyField()
    is_trial = serializers.ReadOnlyField()

    class Meta:
        model = UserSubscription
        fields = [
            'id', 'user', 'plan', 'plan_id', 'status', 'start_date', 'trial_end',
            'current_period_start', 'current_period_end', 'canceled_at',
            'auto_renew', 'cancel_at_period_end', 'stripe_subscription_id',
            'stripe_customer_id', 'metadata', 'is_active', 'days_until_renewal',
            'is_trial', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class UserSubscriptionListSerializer(serializers.ModelSerializer):
    """Simplified subscription list"""
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    is_active = serializers.ReadOnlyField()
    days_until_renewal = serializers.ReadOnlyField()

    class Meta:
        model = UserSubscription
        fields = [
            'id', 'plan_name', 'status', 'current_period_end',
            'is_active', 'days_until_renewal', 'auto_renew'
        ]


# ==================== Payments ====================

class PaymentSerializer(serializers.ModelSerializer):
    """Payment transaction serializer"""
    is_successful = serializers.ReadOnlyField()

    class Meta:
        model = Payment
        ref_name = 'SubscriptionPayment'
        fields = [
            'id', 'user', 'subscription', 'amount', 'currency', 'payment_method',
            'status', 'stripe_payment_intent_id', 'payme_transaction_id',
            'click_transaction_id', 'description', 'receipt_url', 'failure_reason',
            'metadata', 'is_successful', 'created_at', 'updated_at', 'succeeded_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at', 'succeeded_at']


class PaymentListSerializer(serializers.ModelSerializer):
    """Simplified payment list"""
    subscription_plan = serializers.CharField(source='subscription.plan.name', read_only=True, allow_null=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'amount', 'currency', 'payment_method', 'status',
            'subscription_plan', 'created_at'
        ]


class PaymentCreateSerializer(serializers.Serializer):
    """Create payment serializer"""
    subscription_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField(max_length=3, default='USD')
    payment_method = serializers.ChoiceField(choices=Payment.PAYMENT_METHOD_CHOICES)
    description = serializers.CharField(required=False, allow_blank=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value


# ==================== Invoices ====================

class InvoiceSerializer(serializers.ModelSerializer):
    """Invoice serializer"""
    subscription_plan = serializers.CharField(source='subscription.plan.name', read_only=True, allow_null=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'user', 'subscription', 'subscription_plan', 'payment',
            'invoice_number', 'status', 'subtotal', 'tax', 'discount', 'total',
            'currency', 'line_items', 'issue_date', 'due_date', 'paid_at',
            'stripe_invoice_id', 'pdf_url', 'notes', 'metadata',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['invoice_number', 'user', 'created_at', 'updated_at', 'paid_at']


# ==================== Payment Methods ====================

class PaymentMethodSerializer(serializers.ModelSerializer):
    """Payment method serializer"""

    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'user', 'method_type', 'card_last4', 'card_brand',
            'card_exp_month', 'card_exp_year', 'bank_name', 'account_last4',
            'stripe_payment_method_id', 'is_default', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class PaymentMethodCreateSerializer(serializers.Serializer):
    """Create payment method"""
    method_type = serializers.ChoiceField(choices=PaymentMethod.METHOD_TYPE_CHOICES)
    stripe_payment_method_id = serializers.CharField(required=False)
    is_default = serializers.BooleanField(default=False)


# ==================== Coupons ====================

class CouponSerializer(serializers.ModelSerializer):
    """Coupon serializer"""
    applicable_plan_names = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'name', 'discount_type', 'discount_value', 'currency',
            'max_redemptions', 'redemptions_count', 'min_purchase_amount',
            'valid_from', 'valid_until', 'applicable_plans', 'applicable_plan_names',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['redemptions_count', 'created_at', 'updated_at']

    def get_applicable_plan_names(self, obj) -> Any:
        return [plan.name for plan in obj.applicable_plans.all()]


class CouponValidateSerializer(serializers.Serializer):
    """Validate coupon code"""
    code = serializers.CharField(max_length=50)
    plan_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def validate(self, data):
        code = data.get('code')
        try:
            coupon = Coupon.objects.get(code=code)
            is_valid, message = coupon.is_valid()
            if not is_valid:
                raise serializers.ValidationError({'code': message})
            data['coupon'] = coupon
        except Coupon.DoesNotExist:
            raise serializers.ValidationError({'code': 'Invalid coupon code'})
        return data


class CouponUsageSerializer(serializers.ModelSerializer):
    """Coupon usage history"""
    coupon_code = serializers.CharField(source='coupon.code', read_only=True)
    coupon_name = serializers.CharField(source='coupon.name', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = CouponUsage
        fields = [
            'id', 'coupon', 'coupon_code', 'coupon_name', 'user', 'user_name',
            'subscription', 'payment', 'discount_amount', 'original_amount',
            'final_amount', 'used_at'
        ]
        read_only_fields = ['used_at']


# ==================== Revenue ====================

class RevenueRecordSerializer(serializers.ModelSerializer):
    """Revenue record serializer"""

    class Meta:
        model = RevenueRecord
        fields = [
            'id', 'payment', 'revenue_type', 'amount', 'currency',
            'gross_amount', 'fees', 'net_amount', 'revenue_date',
            'revenue_month', 'revenue_year', 'created_at'
        ]
        read_only_fields = ['revenue_month', 'revenue_year', 'created_at']


# ==================== Statistics ====================

class SubscriptionStatsSerializer(serializers.Serializer):
    """Subscription statistics"""
    total_active_subscriptions = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    mrr = serializers.DecimalField(max_digits=12, decimal_places=2)  # Monthly Recurring Revenue
    arr = serializers.DecimalField(max_digits=12, decimal_places=2)  # Annual Recurring Revenue
    churn_rate = serializers.FloatField()
    avg_subscription_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_customers = serializers.IntegerField()
    new_customers_this_month = serializers.IntegerField()
    cancellations_this_month = serializers.IntegerField()


class RevenueStatsSerializer(serializers.Serializer):
    """Revenue statistics"""
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_payments = serializers.IntegerField()
    successful_payments = serializers.IntegerField()
    failed_payments = serializers.IntegerField()
    avg_transaction_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    revenue_by_month = serializers.ListField(child=serializers.DictField())
    revenue_by_payment_method = serializers.DictField()

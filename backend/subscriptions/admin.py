"""
Subscription & Payment Admin Interface
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import (
    SubscriptionPlan, UserSubscription, Payment, Invoice,
    PaymentMethod, Coupon, CouponUsage, RevenueRecord
)


# ==================== Subscription Plans ====================

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'price_display', 'interval', 'trial_period_days',
        'max_users', 'is_active', 'is_featured', 'display_order', 'subscription_count'
    ]
    list_filter = ['interval', 'is_active', 'is_featured', 'currency']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['created_at', 'updated_at', 'subscription_count']
    ordering = ['display_order', 'price']

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'slug', 'description', 'is_active', 'is_featured', 'display_order')
        }),
        ('Pricing', {
            'fields': ('price', 'currency', 'interval', 'trial_period_days')
        }),
        ('Limits', {
            'fields': ('max_users', 'max_courses', 'max_storage_gb')
        }),
        ('Features', {
            'fields': ('features',),
            'description': 'JSON format: ["Feature 1", "Feature 2", ...]'
        }),
        ('Stripe Integration', {
            'fields': ('stripe_price_id', 'stripe_product_id'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at', 'subscription_count'),
            'classes': ('collapse',)
        }),
    )

    def price_display(self, obj):
        return f"{obj.price} {obj.currency}/{obj.interval}"
    price_display.short_description = 'Price'

    def subscription_count(self, obj):
        count = obj.subscriptions.filter(status__in=['active', 'trialing']).count()
        return format_html('<strong>{}</strong> active', count)
    subscription_count.short_description = 'Active Subscriptions'


# ==================== User Subscriptions ====================

@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'user_link', 'plan', 'status_badge', 'current_period_end',
        'auto_renew', 'cancel_at_period_end', 'created_at'
    ]
    list_filter = ['status', 'plan', 'auto_renew', 'cancel_at_period_end', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'stripe_subscription_id']
    readonly_fields = ['created_at', 'updated_at', 'days_remaining', 'total_payments']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Subscription Details', {
            'fields': ('user', 'plan', 'status')
        }),
        ('Billing Period', {
            'fields': ('start_date', 'trial_end', 'current_period_start', 'current_period_end')
        }),
        ('Settings', {
            'fields': ('auto_renew', 'cancel_at_period_end', 'canceled_at')
        }),
        ('Stripe Integration', {
            'fields': ('stripe_subscription_id', 'stripe_customer_id'),
            'classes': ('collapse',)
        }),
        ('Additional Info', {
            'fields': ('metadata', 'created_at', 'updated_at', 'days_remaining', 'total_payments'),
            'classes': ('collapse',)
        }),
    )

    def user_link(self, obj):
        url = reverse('admin:users_user_change', args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email)
    user_link.short_description = 'User'

    def status_badge(self, obj):
        colors = {
            'active': 'green',
            'trialing': 'blue',
            'past_due': 'orange',
            'canceled': 'red',
            'expired': 'gray'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def days_remaining(self, obj):
        if obj.current_period_end:
            days = (obj.current_period_end - timezone.now()).days
            return f"{days} days" if days > 0 else "Expired"
        return "N/A"
    days_remaining.short_description = 'Days Remaining'

    def total_payments(self, obj):
        total = obj.payments.filter(status='succeeded').count()
        return format_html('<a href="{}?subscription__id__exact={}">{} payments</a>',
                          reverse('admin:subscriptions_payment_changelist'), obj.id, total)
    total_payments.short_description = 'Payments'


# ==================== Payments ====================

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_link', 'amount_display', 'payment_method',
        'status_badge', 'created_at', 'succeeded_at'
    ]
    list_filter = ['status', 'payment_method', 'currency', 'created_at']
    search_fields = [
        'user__email', 'user__first_name', 'user__last_name',
        'stripe_payment_intent_id', 'payme_transaction_id', 'click_transaction_id'
    ]
    readonly_fields = ['created_at', 'updated_at', 'succeeded_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Payment Details', {
            'fields': ('user', 'subscription', 'amount', 'currency', 'payment_method', 'status')
        }),
        ('Transaction IDs', {
            'fields': ('stripe_payment_intent_id', 'payme_transaction_id', 'click_transaction_id')
        }),
        ('Additional Info', {
            'fields': ('description', 'receipt_url', 'failure_reason')
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at', 'succeeded_at'),
            'classes': ('collapse',)
        }),
    )

    def user_link(self, obj):
        url = reverse('admin:users_user_change', args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email)
    user_link.short_description = 'User'

    def amount_display(self, obj):
        return f"{obj.amount} {obj.currency}"
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        colors = {
            'pending': 'orange',
            'processing': 'blue',
            'succeeded': 'green',
            'failed': 'red',
            'refunded': 'purple',
            'canceled': 'gray'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


# ==================== Invoices ====================

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number', 'user_link', 'total_display',
        'status_badge', 'issue_date', 'due_date', 'paid_at'
    ]
    list_filter = ['status', 'currency', 'issue_date', 'paid_at']
    search_fields = ['invoice_number', 'user__email', 'stripe_invoice_id']
    readonly_fields = ['invoice_number', 'created_at', 'updated_at', 'paid_at']
    date_hierarchy = 'issue_date'

    fieldsets = (
        ('Invoice Details', {
            'fields': ('invoice_number', 'user', 'subscription', 'payment', 'status')
        }),
        ('Amounts', {
            'fields': ('subtotal', 'tax', 'discount', 'total', 'currency')
        }),
        ('Line Items', {
            'fields': ('line_items',),
            'description': 'JSON format: [{"description": "...", "amount": ...}, ...]'
        }),
        ('Dates', {
            'fields': ('issue_date', 'due_date', 'paid_at')
        }),
        ('Additional Info', {
            'fields': ('stripe_invoice_id', 'pdf_url', 'notes'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def user_link(self, obj):
        url = reverse('admin:users_user_change', args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email)
    user_link.short_description = 'User'

    def total_display(self, obj):
        return f"{obj.total} {obj.currency}"
    total_display.short_description = 'Total'

    def status_badge(self, obj):
        colors = {
            'draft': 'gray',
            'open': 'blue',
            'paid': 'green',
            'void': 'red',
            'uncollectible': 'orange'
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


# ==================== Payment Methods ====================

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = [
        'user_link', 'method_type', 'card_display',
        'is_default', 'is_active', 'created_at'
    ]
    list_filter = ['method_type', 'is_default', 'is_active', 'card_brand']
    search_fields = ['user__email', 'card_last4', 'stripe_payment_method_id']
    readonly_fields = ['created_at', 'updated_at']

    def user_link(self, obj):
        url = reverse('admin:users_user_change', args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email)
    user_link.short_description = 'User'

    def card_display(self, obj):
        if obj.method_type == 'card' and obj.card_last4:
            return f"{obj.card_brand.upper()} ****{obj.card_last4} ({obj.card_exp_month}/{obj.card_exp_year})"
        elif obj.method_type == 'bank_account' and obj.account_last4:
            return f"{obj.bank_name} ****{obj.account_last4}"
        return obj.method_type.upper()
    card_display.short_description = 'Payment Method'


# ==================== Coupons ====================

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'name', 'discount_display', 'usage_display',
        'validity_period', 'is_active', 'created_at'
    ]
    list_filter = ['discount_type', 'is_active', 'valid_from', 'valid_until']
    search_fields = ['code', 'name']
    readonly_fields = ['redemptions_count', 'created_at', 'updated_at']
    filter_horizontal = ['applicable_plans']

    fieldsets = (
        ('Basic Information', {
            'fields': ('code', 'name', 'is_active')
        }),
        ('Discount', {
            'fields': ('discount_type', 'discount_value', 'currency', 'min_purchase_amount')
        }),
        ('Usage Limits', {
            'fields': ('max_redemptions', 'redemptions_count')
        }),
        ('Validity', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('Applicable Plans', {
            'fields': ('applicable_plans',),
            'description': 'Leave empty to apply to all plans'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def discount_display(self, obj):
        if obj.discount_type == 'percentage':
            return f"{obj.discount_value}% off"
        return f"{obj.discount_value} {obj.currency} off"
    discount_display.short_description = 'Discount'

    def usage_display(self, obj):
        if obj.max_redemptions:
            return f"{obj.redemptions_count} / {obj.max_redemptions}"
        return f"{obj.redemptions_count} / ∞"
    usage_display.short_description = 'Usage'

    def validity_period(self, obj):
        now = timezone.now()
        if obj.valid_until and obj.valid_until < now:
            return format_html('<span style="color: red;">Expired</span>')
        elif obj.valid_from > now:
            return format_html('<span style="color: orange;">Not started</span>')
        return format_html('<span style="color: green;">Active</span>')
    validity_period.short_description = 'Validity'


# ==================== Coupon Usage ====================

@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = [
        'coupon_link', 'user_link', 'discount_amount',
        'original_amount', 'final_amount', 'used_at'
    ]
    list_filter = ['used_at', 'coupon']
    search_fields = ['coupon__code', 'user__email']
    readonly_fields = ['used_at']
    date_hierarchy = 'used_at'

    def coupon_link(self, obj):
        url = reverse('admin:subscriptions_coupon_change', args=[obj.coupon.id])
        return format_html('<a href="{}">{}</a>', url, obj.coupon.code)
    coupon_link.short_description = 'Coupon'

    def user_link(self, obj):
        url = reverse('admin:users_user_change', args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.get_full_name() or obj.user.email)
    user_link.short_description = 'User'


# ==================== Revenue Records ====================

@admin.register(RevenueRecord)
class RevenueRecordAdmin(admin.ModelAdmin):
    list_display = [
        'payment_link', 'revenue_type', 'gross_amount',
        'fees', 'net_amount', 'currency', 'revenue_date'
    ]
    list_filter = ['revenue_type', 'currency', 'revenue_year', 'revenue_month']
    search_fields = ['payment__id']
    readonly_fields = ['revenue_month', 'revenue_year', 'created_at']
    date_hierarchy = 'revenue_date'

    fieldsets = (
        ('Revenue Details', {
            'fields': ('payment', 'revenue_type', 'revenue_date')
        }),
        ('Amounts', {
            'fields': ('gross_amount', 'fees', 'net_amount', 'amount', 'currency')
        }),
        ('Metadata', {
            'fields': ('revenue_month', 'revenue_year', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def payment_link(self, obj):
        url = reverse('admin:subscriptions_payment_change', args=[obj.payment.id])
        return format_html('<a href="{}">Payment #{}</a>', url, obj.payment.id)
    payment_link.short_description = 'Payment'

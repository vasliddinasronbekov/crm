"""
Subscription & Payment URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubscriptionPlanViewSet,
    UserSubscriptionViewSet,
    PaymentViewSet,
    InvoiceViewSet,
    PaymentMethodViewSet,
    CouponViewSet,
    SubscriptionStatsViewSet
)
from .webhook_views import stripe_webhook, payme_webhook, click_webhook

app_name = 'subscriptions'

router = DefaultRouter()
router.register(r'plans', SubscriptionPlanViewSet, basename='plan')
router.register(r'subscriptions', UserSubscriptionViewSet, basename='subscription')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'coupons', CouponViewSet, basename='coupon')
router.register(r'stats', SubscriptionStatsViewSet, basename='stats')

urlpatterns = [
    # Webhooks (must be before router.urls to avoid auth issues)
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
    path('webhooks/payme/', payme_webhook, name='payme-webhook'),
    path('webhooks/click/', click_webhook, name='click-webhook'),

    # REST API
    path('', include(router.urls)),
]

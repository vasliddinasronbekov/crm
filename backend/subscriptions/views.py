"""
Subscription & Payment API Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import (
    SubscriptionPlan, UserSubscription, Payment, Invoice,
    PaymentMethod, Coupon, CouponUsage
)
from .serializers import *


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """Subscription plans - List available plans"""
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    permission_classes = [AllowAny]
    ordering = ['display_order', 'price']

    def get_serializer_class(self):
        return SubscriptionPlanListSerializer if self.action == 'list' else SubscriptionPlanSerializer

    @action(detail=False, methods=['get'])
    def featured(self, request):
        plans = self.queryset.filter(is_featured=True)
        return Response(self.get_serializer(plans, many=True).data)


class UserSubscriptionViewSet(viewsets.ModelViewSet):
    """User subscriptions - Manage subscription lifecycle"""
    queryset = UserSubscription.objects.all().select_related('plan', 'user')
    serializer_class = UserSubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset if self.request.user.is_staff else self.queryset.filter(user=self.request.user)

    def get_serializer_class(self):
        return UserSubscriptionListSerializer if self.action == 'list' else UserSubscriptionSerializer

    @action(detail=False, methods=['get'])
    def my_subscription(self, request):
        try:
            sub = UserSubscription.objects.get(user=request.user, status__in=['active', 'trialing'])
            return Response(self.get_serializer(sub).data)
        except UserSubscription.DoesNotExist:
            return Response({'detail': 'No active subscription'}, status=404)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        sub = self.get_object()
        if sub.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        immediate = request.data.get('immediate', False)
        sub.cancel(immediate=immediate)
        return Response({'status': 'canceled' if immediate else 'will cancel at period end'})

    @action(detail=True, methods=['post'])
    def change_plan(self, request, pk=None):
        sub = self.get_object()
        if sub.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        try:
            plan = SubscriptionPlan.objects.get(id=request.data['plan_id'], is_active=True)
            sub.plan = plan
            sub.save()
            return Response(self.get_serializer(sub).data)
        except (SubscriptionPlan.DoesNotExist, KeyError):
            return Response({'error': 'Invalid plan'}, status=400)


class PaymentViewSet(viewsets.ModelViewSet):
    """Payments - Manage payment transactions"""
    queryset = Payment.objects.all().select_related('user', 'subscription')
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']

    def get_queryset(self):
        return self.queryset if self.request.user.is_staff else self.queryset.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return PaymentCreateSerializer
        return PaymentListSerializer if self.action == 'list' else PaymentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = Payment.objects.create(
            user=request.user,
            amount=serializer.validated_data['amount'],
            currency=serializer.validated_data.get('currency', 'USD'),
            payment_method=serializer.validated_data['payment_method'],
            description=serializer.validated_data.get('description', ''),
            subscription_id=serializer.validated_data.get('subscription_id'),
            status='pending'
        )

        return Response(PaymentSerializer(payment).data, status=201)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Invoices - View and download invoices"""
    queryset = Invoice.objects.all().select_related('user', 'subscription', 'payment')
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']

    def get_queryset(self):
        return self.queryset if self.request.user.is_staff else self.queryset.filter(user=self.request.user)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """Payment methods - Manage saved payment methods"""
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        payment_method = self.get_object()
        PaymentMethod.objects.filter(user=request.user, is_default=True).update(is_default=False)
        payment_method.is_default = True
        payment_method.save()
        return Response({'status': 'set as default'})


class CouponViewSet(viewsets.ReadOnlyModelViewSet):
    """Coupons - View and validate coupons"""
    queryset = Coupon.objects.filter(is_active=True)
    serializer_class = CouponSerializer
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        return [IsAuthenticated()] if self.action == 'validate' else super().get_permissions()

    @action(detail=False, methods=['post'])
    def validate(self, request):
        serializer = CouponValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        coupon = serializer.validated_data['coupon']
        amount = serializer.validated_data.get('amount')

        response = {
            'valid': True,
            'code': coupon.code,
            'name': coupon.name,
            'discount_type': coupon.discount_type,
            'discount_value': coupon.discount_value
        }

        if amount:
            discount = coupon.calculate_discount(amount)
            response.update({'discount_amount': discount, 'final_amount': amount - discount})

        return Response(response)


class SubscriptionStatsViewSet(viewsets.ViewSet):
    """Subscription statistics - Analytics dashboard"""
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        now = timezone.now()
        active_subs = UserSubscription.objects.filter(status__in=['active', 'trialing'])

        total_revenue = Payment.objects.filter(status='succeeded').aggregate(
            total=Sum('amount'))['total'] or Decimal('0')

        monthly_plans = SubscriptionPlan.objects.filter(interval='monthly')
        mrr = active_subs.filter(plan__in=monthly_plans).aggregate(
            total=Sum('plan__price'))['total'] or Decimal('0')

        stats = {
            'total_active_subscriptions': active_subs.count(),
            'total_revenue': total_revenue,
            'mrr': mrr,
            'arr': mrr * 12,
            'churn_rate': 0.0,  # Calculate based on your needs
            'avg_subscription_value': active_subs.aggregate(avg=Avg('plan__price'))['avg'] or Decimal('0'),
            'total_customers': UserSubscription.objects.values('user').distinct().count(),
            'new_customers_this_month': UserSubscription.objects.filter(
                created_at__gte=now.replace(day=1)).count(),
            'cancellations_this_month': UserSubscription.objects.filter(
                canceled_at__gte=now.replace(day=1)).count()
        }

        return Response(SubscriptionStatsSerializer(stats).data)

    @action(detail=False, methods=['get'])
    def revenue(self, request):
        payments = Payment.objects.filter(status='succeeded')
        total = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        stats = {
            'total_revenue': total,
            'total_payments': Payment.objects.count(),
            'successful_payments': payments.count(),
            'failed_payments': Payment.objects.filter(status='failed').count(),
            'avg_transaction_value': payments.aggregate(avg=Avg('amount'))['avg'] or Decimal('0'),
            'revenue_by_month': [],
            'revenue_by_payment_method': {}
        }

        return Response(RevenueStatsSerializer(stats).data)

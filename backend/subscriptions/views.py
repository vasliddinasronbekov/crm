"""
Subscription & Payment API Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from users.models import User
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
)

from .models import (
    SubscriptionPlan, UserSubscription, Payment, Invoice,
    PaymentMethod, Coupon, CouponUsage
)
from .serializers import *


def _active_scope_out_of_branch_users(request):
    user = request.user
    active_branch_id = get_effective_branch_id(request, user)
    if active_branch_id is None:
        return None
    return User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()


def _scope_queryset_to_active_branch_user(queryset, request, *, user_field='user'):
    user = request.user
    active_branch_id = get_effective_branch_id(request, user)

    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    scoped_queryset = queryset.filter(
        build_user_branch_q(active_branch_id, user_field)
    ).distinct()
    out_of_scope_users = User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()
    return scoped_queryset.exclude(
        **{f'{user_field}__in': out_of_scope_users}
    ).distinct()


def _exclude_legacy_cross_branch_user_links(queryset, request, *, relation_user_fields):
    out_of_scope_users = _active_scope_out_of_branch_users(request)
    if out_of_scope_users is None:
        return queryset

    for relation_user_field in relation_user_fields:
        queryset = queryset.exclude(
            **{f'{relation_user_field}__in': out_of_scope_users}
        )
    return queryset.distinct()


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
        if not self.request.user.is_staff:
            return self.queryset.filter(user=self.request.user)
        return _scope_queryset_to_active_branch_user(
            self.queryset,
            self.request,
            user_field='user',
        )

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
        if not self.request.user.is_staff:
            return self.queryset.filter(user=self.request.user)
        scoped_queryset = _scope_queryset_to_active_branch_user(
            self.queryset,
            self.request,
            user_field='user',
        )
        return _exclude_legacy_cross_branch_user_links(
            scoped_queryset,
            self.request,
            relation_user_fields=('subscription__user',),
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return PaymentCreateSerializer
        return PaymentListSerializer if self.action == 'list' else PaymentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription_id = serializer.validated_data.get('subscription_id')
        subscription = None
        if subscription_id is not None:
            subscription = UserSubscription.objects.filter(id=subscription_id).select_related('user').first()
            if subscription is None:
                return Response({'error': 'Invalid subscription'}, status=status.HTTP_400_BAD_REQUEST)

            if not request.user.is_staff and subscription.user_id != request.user.id:
                raise PermissionDenied('You do not have permission to charge this subscription.')

            if request.user.is_staff:
                allowed_subscription = _scope_queryset_to_active_branch_user(
                    UserSubscription.objects.filter(id=subscription.id),
                    request,
                    user_field='user',
                ).exists()
                if not allowed_subscription:
                    raise PermissionDenied('Selected subscription is outside your active branch scope.')

        payment = Payment.objects.create(
            user=request.user,
            amount=serializer.validated_data['amount'],
            currency=serializer.validated_data.get('currency', 'USD'),
            payment_method=serializer.validated_data['payment_method'],
            description=serializer.validated_data.get('description', ''),
            subscription=subscription,
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
        if not self.request.user.is_staff:
            return self.queryset.filter(user=self.request.user)
        scoped_queryset = _scope_queryset_to_active_branch_user(
            self.queryset,
            self.request,
            user_field='user',
        )
        return _exclude_legacy_cross_branch_user_links(
            scoped_queryset,
            self.request,
            relation_user_fields=('subscription__user', 'payment__user'),
        )


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
    serializer_class = SubscriptionStatsSerializer
    queryset = UserSubscription.objects.all()

    def _scoped_subscriptions(self, request):
        return _scope_queryset_to_active_branch_user(
            UserSubscription.objects.all(),
            request,
            user_field='user',
        )

    def _scoped_payments(self, request):
        scoped_payments = _scope_queryset_to_active_branch_user(
            Payment.objects.all(),
            request,
            user_field='user',
        )
        return _exclude_legacy_cross_branch_user_links(
            scoped_payments,
            request,
            relation_user_fields=('subscription__user',),
        )

    @action(detail=False, methods=['get'])
    def overview(self, request):
        now = timezone.now()
        subscriptions = self._scoped_subscriptions(request)
        active_subs = subscriptions.filter(status__in=['active', 'trialing'])

        total_revenue = self._scoped_payments(request).filter(status='succeeded').aggregate(
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
            'total_customers': subscriptions.values('user').distinct().count(),
            'new_customers_this_month': subscriptions.filter(
                created_at__gte=now.replace(day=1)).count(),
            'cancellations_this_month': subscriptions.filter(
                canceled_at__gte=now.replace(day=1)).count()
        }

        return Response(SubscriptionStatsSerializer(stats).data)

    @action(detail=False, methods=['get'])
    def revenue(self, request):
        scoped_payments = self._scoped_payments(request)
        payments = scoped_payments.filter(status='succeeded')
        total = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        stats = {
            'total_revenue': total,
            'total_payments': scoped_payments.count(),
            'successful_payments': payments.count(),
            'failed_payments': scoped_payments.filter(status='failed').count(),
            'avg_transaction_value': payments.aggregate(avg=Avg('amount'))['avg'] or Decimal('0'),
            'revenue_by_month': [],
            'revenue_by_payment_method': {}
        }

        return Response(RevenueStatsSerializer(stats).data)

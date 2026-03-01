"""
Affiliate Program API Views
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .affiliate_models import (
    AffiliateProfile, Referral, AffiliateCommission,
    AffiliatePayout, ReferralClick, AffiliateCampaign
)
from .affiliate_serializers import *


class AffiliateProfileViewSet(viewsets.ModelViewSet):
    """Affiliate profile management"""
    queryset = AffiliateProfile.objects.all()
    serializer_class = AffiliateProfileSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'referral_code']
    ordering_fields = ['total_earnings', 'successful_referrals', 'created_at']

    def get_queryset(self):
        if self.request.user.is_staff:
            return self.queryset
        # Users can only see their own profile
        return self.queryset.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get current user's affiliate profile"""
        try:
            profile = AffiliateProfile.objects.get(user=request.user)
            return Response(AffiliateProfileSerializer(profile).data)
        except AffiliateProfile.DoesNotExist:
            return Response({'detail': 'Not an affiliate'}, status=404)

    @action(detail=False, methods=['post'])
    def join(self, request):
        """Join affiliate program"""
        if hasattr(request.user, 'affiliate_profile'):
            return Response({'error': 'Already an affiliate'}, status=400)

        profile = AffiliateProfile.objects.create(
            user=request.user,
            payout_email=request.data.get('payout_email', request.user.email),
            payout_method=request.data.get('payout_method', 'PayPal')
        )
        return Response(AffiliateProfileSerializer(profile).data, status=201)

    @action(detail=False, methods=['post'])
    def set_vanity_code(self, request):
        """Set custom vanity code"""
        try:
            profile = request.user.affiliate_profile
        except AttributeError:
            return Response({'error': 'Not an affiliate'}, status=400)

        vanity_code = request.data.get('vanity_code', '').upper()

        # Validate vanity code
        if len(vanity_code) < 3 or len(vanity_code) > 20:
            return Response({'error': 'Code must be 3-20 characters'}, status=400)

        if not vanity_code.isalnum():
            return Response({'error': 'Code must be alphanumeric'}, status=400)

        # Check uniqueness
        if AffiliateProfile.objects.filter(vanity_code=vanity_code).exists():
            return Response({'error': 'Code already taken'}, status=400)

        profile.vanity_code = vanity_code
        profile.save()

        return Response({'vanity_code': vanity_code})

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get affiliate analytics"""
        profile = self.get_object()

        # Permission check
        if profile.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        # Calculate analytics
        total_clicks = ReferralClick.objects.filter(affiliate=profile).count()
        conversion_rate = 0
        if profile.total_referrals > 0:
            conversion_rate = (profile.successful_referrals / profile.total_referrals) * 100

        avg_commission = AffiliateCommission.objects.filter(
            affiliate=profile,
            status='approved'
        ).aggregate(avg=Avg('amount'))['avg'] or Decimal('0')

        # Monthly earnings (last 12 months)
        monthly_earnings = []
        now = timezone.now()
        for i in range(12):
            month_start = (now - timedelta(days=30*i)).replace(day=1)
            month_end = month_start + timedelta(days=32)
            month_earnings = AffiliateCommission.objects.filter(
                affiliate=profile,
                earned_at__gte=month_start,
                earned_at__lt=month_end,
                status__in=['approved', 'paid']
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

            monthly_earnings.append({
                'month': month_start.strftime('%Y-%m'),
                'earnings': float(month_earnings)
            })

        # Top referrals
        top_referrals = Referral.objects.filter(
            affiliate=profile,
            status='converted'
        ).order_by('-first_purchase_amount')[:10]

        # Recent commissions
        recent_commissions = AffiliateCommission.objects.filter(
            affiliate=profile
        ).order_by('-earned_at')[:20]

        analytics_data = {
            'total_clicks': total_clicks,
            'total_referrals': profile.total_referrals,
            'successful_referrals': profile.successful_referrals,
            'conversion_rate': conversion_rate,
            'total_earnings': profile.total_earnings,
            'pending_earnings': profile.pending_earnings,
            'total_paid_out': profile.total_paid_out,
            'average_commission': avg_commission,
            'monthly_earnings': monthly_earnings,
            'top_referrals': ReferralSerializer(top_referrals, many=True).data,
            'recent_commissions': AffiliateCommissionSerializer(recent_commissions, many=True).data
        }

        return Response(AffiliateAnalyticsSerializer(analytics_data).data)


class ReferralViewSet(viewsets.ReadOnlyModelViewSet):
    """Referral tracking"""
    queryset = Referral.objects.all().select_related('affiliate', 'referred_user')
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['referred_user__email', 'referred_user__first_name']
    ordering_fields = ['referred_at', 'first_purchase_amount']

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Affiliates see their own referrals
        if hasattr(user, 'affiliate_profile'):
            return self.queryset.filter(affiliate=user.affiliate_profile)

        return self.queryset.none()

    @action(detail=False, methods=['post'])
    def track_click(self, request):
        """Track referral link click"""
        referral_code = request.data.get('referral_code')
        if not referral_code:
            return Response({'error': 'Referral code required'}, status=400)

        try:
            affiliate = AffiliateProfile.objects.get(
                Q(referral_code=referral_code) | Q(vanity_code=referral_code),
                status='active'
            )
        except AffiliateProfile.DoesNotExist:
            return Response({'error': 'Invalid referral code'}, status=404)

        # Track click
        ReferralClick.objects.create(
            affiliate=affiliate,
            referral_code=referral_code,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            referer=request.META.get('HTTP_REFERER', ''),
            utm_source=request.data.get('utm_source', ''),
            utm_medium=request.data.get('utm_medium', ''),
            utm_campaign=request.data.get('utm_campaign', ''),
            utm_term=request.data.get('utm_term', ''),
            utm_content=request.data.get('utm_content', '')
        )

        # Store referral code in session for signup
        request.session['referral_code'] = referral_code

        return Response({'status': 'tracked', 'affiliate_id': affiliate.id})


class AffiliateCommissionViewSet(viewsets.ReadOnlyModelViewSet):
    """Commission tracking"""
    queryset = AffiliateCommission.objects.all().select_related('affiliate', 'referral')
    serializer_class = AffiliateCommissionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['earned_at', 'amount']

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Affiliates see their own commissions
        if hasattr(user, 'affiliate_profile'):
            return self.queryset.filter(affiliate=user.affiliate_profile)

        return self.queryset.none()

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending commissions"""
        if not hasattr(request.user, 'affiliate_profile'):
            return Response({'error': 'Not an affiliate'}, status=403)

        commissions = self.get_queryset().filter(status='pending')
        total = commissions.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return Response({
            'total_pending': total,
            'commissions': AffiliateCommissionSerializer(commissions, many=True).data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """Approve commission (admin only)"""
        commission = self.get_object()
        commission.approve()
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        """Reject commission (admin only)"""
        commission = self.get_object()
        reason = request.data.get('reason', '')
        commission.reject(reason=reason)
        return Response({'status': 'rejected'})


class AffiliatePayoutViewSet(viewsets.ModelViewSet):
    """Payout management"""
    queryset = AffiliatePayout.objects.all().select_related('affiliate')
    serializer_class = AffiliatePayoutSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Affiliates see their own payouts
        if hasattr(user, 'affiliate_profile'):
            return self.queryset.filter(affiliate=user.affiliate_profile)

        return self.queryset.none()

    @action(detail=False, methods=['post'])
    def request_payout(self, request):
        """Request payout of pending commissions"""
        if not hasattr(request.user, 'affiliate_profile'):
            return Response({'error': 'Not an affiliate'}, status=403)

        affiliate = request.user.affiliate_profile

        # Check minimum payout amount
        if affiliate.pending_earnings < affiliate.min_payout_amount:
            return Response({
                'error': f'Minimum payout amount is {affiliate.min_payout_amount}',
                'current_balance': affiliate.pending_earnings
            }, status=400)

        # Get approved commissions that haven't been paid
        pending_commissions = AffiliateCommission.objects.filter(
            affiliate=affiliate,
            status='approved',
            payout__isnull=True
        )

        if not pending_commissions.exists():
            return Response({'error': 'No commissions available for payout'}, status=400)

        total_amount = pending_commissions.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Calculate processing fee (e.g., 2%)
        processing_fee = total_amount * Decimal('0.02')
        net_amount = total_amount - processing_fee

        # Create payout request
        now = timezone.now()
        payout = AffiliatePayout.objects.create(
            affiliate=affiliate,
            amount=total_amount,
            currency='USD',
            payout_method=affiliate.payout_method or 'PayPal',
            payout_email=affiliate.payout_email,
            processing_fee=processing_fee,
            net_amount=net_amount,
            period_start=pending_commissions.earliest('earned_at').earned_at.date(),
            period_end=now.date(),
            status='pending'
        )

        # Link commissions to payout
        pending_commissions.update(payout=payout)

        return Response(AffiliatePayoutSerializer(payout).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def process(self, request, pk=None):
        """Process payout (admin only)"""
        payout = self.get_object()

        if payout.status != 'pending':
            return Response({'error': 'Payout already processed'}, status=400)

        # In production, integrate with payment gateway
        transaction_id = request.data.get('transaction_id', 'MANUAL_PAYOUT')
        payout.mark_completed(transaction_id=transaction_id)

        return Response({'status': 'completed'})


class AffiliateCampaignViewSet(viewsets.ReadOnlyModelViewSet):
    """Affiliate campaigns"""
    queryset = AffiliateCampaign.objects.all()
    serializer_class = AffiliateCampaignSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Public can see active campaigns
        return self.queryset.filter(is_active=True)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get currently running campaigns"""
        now = timezone.now()
        campaigns = self.get_queryset().filter(
            start_date__lte=now,
            end_date__gte=now
        )
        return Response(AffiliateCampaignSerializer(campaigns, many=True).data)


class AffiliateStatsViewSet(viewsets.ViewSet):
    """Platform-wide affiliate statistics"""
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Get affiliate program overview"""
        total_affiliates = AffiliateProfile.objects.count()
        active_affiliates = AffiliateProfile.objects.filter(status='active').count()
        total_referrals = Referral.objects.count()
        total_conversions = Referral.objects.filter(status='converted').count()

        overall_conversion_rate = 0
        if total_referrals > 0:
            overall_conversion_rate = (total_conversions / total_referrals) * 100

        total_commissions = AffiliateCommission.objects.filter(
            status__in=['approved', 'paid']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        pending_commissions = AffiliateCommission.objects.filter(
            status='approved',
            payout__isnull=True
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        total_clicks = ReferralClick.objects.count()

        # Top affiliates
        top_affiliates = AffiliateProfile.objects.filter(
            status='active'
        ).order_by('-total_earnings')[:10]

        stats = {
            'total_affiliates': total_affiliates,
            'active_affiliates': active_affiliates,
            'total_referrals': total_referrals,
            'total_conversions': total_conversions,
            'overall_conversion_rate': overall_conversion_rate,
            'total_commissions_paid': total_commissions,
            'pending_commissions': pending_commissions,
            'total_clicks': total_clicks,
            'top_affiliates': AffiliateProfileSerializer(top_affiliates, many=True).data
        }

        return Response(AffiliateStatsSerializer(stats).data)

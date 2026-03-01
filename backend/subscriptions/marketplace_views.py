"""
Marketplace API Views

Endpoints for two-sided marketplace platform
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .marketplace_models import (
    ContentCreator, CreatorCourse, CoursePurchase,
    CreatorEarnings, CreatorPayout, CourseReview
)
from .marketplace_serializers import *
from .models import Payment


# ==================== Content Creator ViewSet ====================

class ContentCreatorViewSet(viewsets.ModelViewSet):
    """Content creator profiles and management"""
    queryset = ContentCreator.objects.all()
    serializer_class = ContentCreatorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['display_name', 'bio', 'expertise']
    ordering_fields = ['total_revenue', 'total_students', 'average_rating', 'created_at']

    def get_queryset(self):
        if self.request.user.is_staff:
            return self.queryset
        # Users can only see active/verified creators or their own profile
        return self.queryset.filter(
            Q(status='active') | Q(user=self.request.user)
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return ContentCreatorListSerializer
        return ContentCreatorSerializer

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        """Get current user's creator profile"""
        try:
            creator = ContentCreator.objects.get(user=request.user)
            return Response(ContentCreatorSerializer(creator).data)
        except ContentCreator.DoesNotExist:
            return Response({'detail': 'Not a content creator'}, status=404)

    @action(detail=False, methods=['post'])
    def apply(self, request):
        """Apply to become a content creator"""
        if hasattr(request.user, 'creator_profile'):
            return Response({'error': 'Already a content creator'}, status=400)

        serializer = ContentCreatorSerializer(data=request.data)
        if serializer.is_valid():
            creator = serializer.save(user=request.user, status='pending')
            return Response(ContentCreatorSerializer(creator).data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """Approve creator application (admin only)"""
        creator = self.get_object()
        creator.approve()
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def suspend(self, request, pk=None):
        """Suspend creator (admin only)"""
        creator = self.get_object()
        creator.status = 'suspended'
        creator.save()
        return Response({'status': 'suspended'})

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get creator analytics"""
        creator = self.get_object()

        # Permission check
        if creator.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        # Calculate analytics
        now = timezone.now()
        last_30_days = now - timedelta(days=30)

        pending_earnings = CreatorEarnings.objects.filter(
            creator=creator,
            is_paid_out=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Monthly revenue (last 12 months)
        monthly_revenue = []
        for i in range(12):
            month_start = (now - timedelta(days=30*i)).replace(day=1)
            month_earnings = CreatorEarnings.objects.filter(
                creator=creator,
                earned_at__gte=month_start,
                earned_at__lt=month_start + timedelta(days=32)
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            monthly_revenue.append({
                'month': month_start.strftime('%Y-%m'),
                'revenue': monthly_revenue
            })

        # Top courses
        top_courses = creator.courses.filter(status='published').order_by('-total_revenue')[:5]

        # Recent sales
        recent_sales = CoursePurchase.objects.filter(
            creator=creator,
            status='completed'
        ).order_by('-purchased_at')[:10]

        analytics_data = {
            'total_revenue': creator.total_revenue,
            'pending_earnings': pending_earnings,
            'total_students': creator.total_students,
            'total_courses': creator.total_courses,
            'average_rating': creator.average_rating,
            'total_reviews': creator.courses.aggregate(total=Sum('total_reviews'))['total'] or 0,
            'monthly_revenue': monthly_revenue,
            'top_courses': CreatorCourseListSerializer(top_courses, many=True).data,
            'recent_sales': CoursePurchaseSerializer(recent_sales, many=True).data
        }

        return Response(CreatorAnalyticsSerializer(analytics_data).data)


# ==================== Creator Course ViewSet ====================

class CreatorCourseViewSet(viewsets.ModelViewSet):
    """Marketplace courses"""
    queryset = CreatorCourse.objects.all().select_related('creator')
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'short_description']
    ordering_fields = ['price', 'total_students', 'average_rating', 'published_at']

    def get_queryset(self):
        qs = self.queryset

        # Public can only see published courses
        if not self.request.user.is_staff:
            if self.request.user.is_authenticated and hasattr(self.request.user, 'creator_profile'):
                # Creators can see their own courses
                qs = qs.filter(
                    Q(status='published') |
                    Q(creator__user=self.request.user)
                )
            else:
                qs = qs.filter(status='published')

        # Filters
        level = self.request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)

        language = self.request.query_params.get('language')
        if language:
            qs = qs.filter(language=language)

        creator_id = self.request.query_params.get('creator')
        if creator_id:
            qs = qs.filter(creator_id=creator_id)

        min_price = self.request.query_params.get('min_price')
        if min_price:
            qs = qs.filter(price__gte=min_price)

        max_price = self.request.query_params.get('max_price')
        if max_price:
            qs = qs.filter(price__lte=max_price)

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return CreatorCourseCreateSerializer
        elif self.action == 'list':
            return CreatorCourseListSerializer
        return CreatorCourseSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        """Create course for current creator"""
        try:
            creator = self.request.user.creator_profile
            if creator.status != 'active':
                raise ValueError("Creator account not active")
        except AttributeError:
            raise ValueError("User is not a content creator")

        course = serializer.save(creator=creator, status='draft')
        creator.total_courses += 1
        creator.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def publish(self, request, pk=None):
        """Publish course"""
        course = self.get_object()

        # Permission check
        if course.creator.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        course.publish()
        return Response({'status': 'published'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def purchase(self, request, pk=None):
        """Purchase a course"""
        course = self.get_object()
        student = request.user

        # Check if already purchased
        if CoursePurchase.objects.filter(student=student, course=course).exists():
            return Response({'error': 'Course already purchased'}, status=400)

        # Calculate revenue split
        amount = course.effective_price
        commission_rate = course.creator.commission_rate
        platform_fee = (amount * commission_rate) / 100
        creator_earnings = amount - platform_fee

        # Create purchase
        purchase = CoursePurchase.objects.create(
            student=student,
            course=course,
            creator=course.creator,
            amount_paid=amount,
            currency=course.currency,
            platform_fee=platform_fee,
            creator_earnings=creator_earnings,
            commission_rate=commission_rate,
            status='pending'
        )

        # Create payment (this would integrate with payment gateway)
        # For now, mark as completed
        purchase.complete()

        # Create earnings record
        CreatorEarnings.objects.create(
            creator=course.creator,
            purchase=purchase,
            amount=creator_earnings,
            currency=course.currency
        )

        return Response({
            'purchase_id': purchase.id,
            'status': 'success',
            'message': 'Course purchased successfully'
        }, status=201)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured courses"""
        courses = self.get_queryset().filter(is_featured=True, status='published')[:10]
        return Response(CreatorCourseListSerializer(courses, many=True).data)

    @action(detail=False, methods=['get'])
    def trending(self, request):
        """Get trending courses (most purchases in last 30 days)"""
        last_30_days = timezone.now() - timedelta(days=30)
        courses = self.get_queryset().filter(
            status='published',
            purchases__purchased_at__gte=last_30_days
        ).annotate(
            recent_purchases=Count('purchases')
        ).order_by('-recent_purchases')[:10]

        return Response(CreatorCourseListSerializer(courses, many=True).data)


# ==================== Course Purchase ViewSet ====================

class CoursePurchaseViewSet(viewsets.ReadOnlyModelViewSet):
    """Course purchase history"""
    queryset = CoursePurchase.objects.all().select_related('student', 'course', 'creator')
    serializer_class = CoursePurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Students see their purchases, creators see their sales
        if hasattr(user, 'creator_profile'):
            return self.queryset.filter(
                Q(student=user) | Q(creator=user.creator_profile)
            )

        return self.queryset.filter(student=user)

    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Request refund for a purchase"""
        purchase = self.get_object()

        # Permission check
        if purchase.student != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)

        # Check if within refund period
        if purchase.course.has_money_back_guarantee:
            refund_deadline = purchase.purchased_at + timedelta(days=purchase.course.money_back_days)
            if timezone.now() > refund_deadline:
                return Response({
                    'error': f'Refund period ({purchase.course.money_back_days} days) has expired'
                }, status=400)

        reason = request.data.get('reason', '')
        purchase.refund(reason=reason)

        return Response({'status': 'refunded'})


# ==================== Creator Earnings ViewSet ====================

class CreatorEarningsViewSet(viewsets.ReadOnlyModelViewSet):
    """Creator earnings tracking"""
    queryset = CreatorEarnings.objects.all().select_related('creator', 'purchase')
    serializer_class = CreatorEarningsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Only show creator's own earnings
        if hasattr(user, 'creator_profile'):
            return self.queryset.filter(creator=user.creator_profile)

        return self.queryset.none()

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending (unpaid) earnings"""
        if not hasattr(request.user, 'creator_profile'):
            return Response({'error': 'Not a content creator'}, status=403)

        earnings = self.get_queryset().filter(is_paid_out=False)
        total = earnings.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        return Response({
            'total_pending': total,
            'earnings': CreatorEarningsSerializer(earnings, many=True).data
        })


# ==================== Creator Payout ViewSet ====================

class CreatorPayoutViewSet(viewsets.ModelViewSet):
    """Creator payout management"""
    queryset = CreatorPayout.objects.all().select_related('creator')
    serializer_class = CreatorPayoutSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset

        # Creators see their own payouts
        if hasattr(user, 'creator_profile'):
            return self.queryset.filter(creator=user.creator_profile)

        return self.queryset.none()

    @action(detail=False, methods=['post'])
    def request_payout(self, request):
        """Request a payout of pending earnings"""
        if not hasattr(request.user, 'creator_profile'):
            return Response({'error': 'Not a content creator'}, status=403)

        creator = request.user.creator_profile

        # Get pending earnings
        pending_earnings = CreatorEarnings.objects.filter(
            creator=creator,
            is_paid_out=False
        )
        total_amount = pending_earnings.aggregate(total=Sum('amount'))['total'] or Decimal('0')

        if total_amount <= 0:
            return Response({'error': 'No pending earnings'}, status=400)

        # Minimum payout threshold (e.g., $50)
        min_payout = Decimal('50.00')
        if total_amount < min_payout:
            return Response({
                'error': f'Minimum payout amount is {min_payout}',
                'current_balance': total_amount
            }, status=400)

        # Create payout request
        now = timezone.now()
        payout = CreatorPayout.objects.create(
            creator=creator,
            amount=total_amount,
            currency='USD',  # Default currency
            payout_method=creator.payout_method or 'PayPal',
            payout_email=creator.payout_email,
            period_start=pending_earnings.earliest('earned_at').earned_at.date(),
            period_end=now.date(),
            status='pending'
        )

        # Link earnings to payout
        pending_earnings.update(payout=payout)

        return Response(CreatorPayoutSerializer(payout).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def process(self, request, pk=None):
        """Process a payout (admin only)"""
        payout = self.get_object()

        if payout.status != 'pending':
            return Response({'error': 'Payout already processed'}, status=400)

        # In production, this would integrate with payment gateway
        # For now, mark as completed
        transaction_id = request.data.get('transaction_id', 'MANUAL_PAYOUT')
        payout.mark_completed(transaction_id=transaction_id)

        return Response({'status': 'completed'})


# ==================== Course Review ViewSet ====================

class CourseReviewViewSet(viewsets.ModelViewSet):
    """Course reviews"""
    queryset = CourseReview.objects.all().select_related('course', 'student')
    serializer_class = CourseReviewSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        course_id = self.request.query_params.get('course')
        if course_id:
            return self.queryset.filter(course_id=course_id, is_published=True)
        return self.queryset.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == 'create':
            return CourseReviewCreateSerializer
        return CourseReviewSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        """Create review (must have purchased course)"""
        student = self.request.user
        course = serializer.validated_data['course']

        # Check if student purchased the course
        try:
            purchase = CoursePurchase.objects.get(student=student, course=course, status='completed')
        except CoursePurchase.DoesNotExist:
            raise ValueError("Must purchase course before reviewing")

        serializer.save(student=student, purchase=purchase)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_helpful(self, request, pk=None):
        """Mark review as helpful"""
        review = self.get_object()
        review.helpful_count += 1
        review.save()
        return Response({'helpful_count': review.helpful_count})


# ==================== Marketplace Statistics ====================

class MarketplaceStatsViewSet(viewsets.ViewSet):
    """Platform-wide marketplace statistics"""
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """Get marketplace overview statistics"""
        total_creators = ContentCreator.objects.count()
        active_creators = ContentCreator.objects.filter(status='active').count()
        total_courses = CreatorCourse.objects.filter(status='published').count()
        total_sales = CoursePurchase.objects.filter(status='completed').count()

        total_revenue = CoursePurchase.objects.filter(
            status='completed'
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')

        platform_earnings = CoursePurchase.objects.filter(
            status='completed'
        ).aggregate(total=Sum('platform_fee'))['total'] or Decimal('0')

        creator_earnings = CoursePurchase.objects.filter(
            status='completed'
        ).aggregate(total=Sum('creator_earnings'))['total'] or Decimal('0')

        pending_payouts = CreatorEarnings.objects.filter(
            is_paid_out=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        avg_price = CreatorCourse.objects.filter(
            status='published'
        ).aggregate(avg=Avg('price'))['avg'] or Decimal('0')

        # Top courses
        top_courses = CreatorCourse.objects.filter(
            status='published'
        ).order_by('-total_revenue')[:10]

        # Top creators
        top_creators = ContentCreator.objects.filter(
            status='active'
        ).order_by('-total_revenue')[:10]

        stats = {
            'total_creators': total_creators,
            'active_creators': active_creators,
            'total_marketplace_courses': total_courses,
            'total_course_sales': total_sales,
            'total_marketplace_revenue': total_revenue,
            'platform_earnings': platform_earnings,
            'creator_earnings': creator_earnings,
            'pending_payouts': pending_payouts,
            'average_course_price': avg_price,
            'top_selling_courses': CreatorCourseListSerializer(top_courses, many=True).data,
            'top_creators': ContentCreatorListSerializer(top_creators, many=True).data
        }

        return Response(MarketplaceStatsSerializer(stats).data)

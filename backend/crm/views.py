from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity_models import Activity, Deal
from .models import Lead, LeadDepartment, Source, SubDepartment
from .serializers import (
    SourceSerializer, LeadDepartmentSerializer,
    SubDepartmentSerializer, LeadSerializer, LeadStageTransitionSerializer
)
from .permissions import IsAdminOrResponsiblePerson # <-- YANGI RUXSATNOMANI IMPORT QILAMIZ
from users.permissions import HasRoleCapability


class SourceViewSet(viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer
    permission_classes = [permissions.IsAuthenticated]

class LeadDepartmentViewSet(viewsets.ModelViewSet):
    queryset = LeadDepartment.objects.all()
    serializer_class = LeadDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

class SubDepartmentViewSet(viewsets.ModelViewSet):
    queryset = SubDepartment.objects.all()
    serializer_class = SubDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    # Ruxsatnomani yangilaymiz
    permission_classes = [permissions.IsAuthenticated, HasRoleCapability, IsAdminOrResponsiblePerson]
    action_capabilities = {
        'list': 'crm.read',
        'retrieve': 'crm.read',
        'create': 'crm.manage',
        'update': 'crm.manage',
        'partial_update': 'crm.manage',
        'destroy': 'crm.manage',
        'transition_stage': 'crm.stage_transition',
    }

    def get_queryset(self):
        """
        Agar foydalanuvchi admin yoki staff bo'lsa, barcha lidlarni,
        aks holda faqat o'ziga tegishli lidlarni qaytaradi.
        """
        user = self.request.user
        queryset = Lead.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_staff:
            queryset = Lead.objects.all()
        else:
            queryset = Lead.objects.filter(responsible_person=user)

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('source', 'department', 'sub_department', 'interested_course', 'branch', 'responsible_person').order_by('-created_at')

    def perform_create(self, serializer):
        """
        Yangi lid yaratilayotganda, unga mas'ul shaxs sifatida
        shu so'rovni yuborayotgan foydalanuvchini avtomatik tayinlaydi.
        """
        serializer.save(responsible_person=self.request.user)

    @action(detail=True, methods=['post'], url_path='transition-stage')
    def transition_stage(self, request, pk=None):
        """
        Move lead across status stages with strict transition validation.
        Automatically writes a CRM activity log entry for audit trail.
        """
        lead = self.get_object()
        serializer = LeadStageTransitionSerializer(
            data=request.data,
            context={'lead': lead},
        )
        serializer.is_valid(raise_exception=True)

        old_status = lead.status
        new_status = serializer.validated_data['status']
        if new_status == old_status:
            return Response(LeadSerializer(lead).data)

        lead.status = new_status
        lead.save(update_fields=['status'])

        status_display = dict(Lead.STATUS_CHOICES)
        old_status_display = status_display.get(old_status, old_status)
        new_status_display = status_display.get(new_status, new_status)
        note = serializer.validated_data.get('note', '')
        default_description = (
            f'Lead status changed by {request.user.username} via CRM stage board.'
        )

        Activity.objects.create(
            lead=lead,
            activity_type='status_change',
            subject=f'Stage transition: {old_status_display} -> {new_status_display}',
            description=note or default_description,
            created_by=request.user,
        )

        return Response(LeadSerializer(lead).data)


class CRMInsightsView(APIView):
    """
    Aggregate CRM intelligence data for the dashboard.

    Query params:
    - period_days: integer between 7 and 365 (default: 30)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        period_days = self._parse_period_days(request.query_params.get('period_days'))
        period_start = now - timedelta(days=period_days)
        overdue_threshold = now - timedelta(days=14)

        leads_qs = Lead.objects.select_related('source', 'responsible_person')
        deals_qs = Deal.objects.select_related('lead', 'pipeline', 'stage')
        activities_qs = Activity.objects.select_related('lead', 'created_by')

        # Non-staff users only see their own pipeline data.
        if not (request.user.is_superuser or request.user.is_staff):
            leads_qs = leads_qs.filter(responsible_person=request.user)
            deals_qs = deals_qs.filter(lead__responsible_person=request.user)
            activities_qs = activities_qs.filter(lead__responsible_person=request.user)

        lead_status_counts = dict(
            leads_qs.values_list('status').annotate(count=Count('id'))
        )
        total_leads = sum(lead_status_counts.values())
        converted_leads = lead_status_counts.get('converted', 0)
        conversion_rate = (converted_leads / total_leads * 100) if total_leads else 0.0

        period_leads_qs = leads_qs.filter(created_at__gte=period_start)
        period_created = period_leads_qs.count()
        period_converted = period_leads_qs.filter(status='converted').count()

        open_deals_qs = deals_qs.filter(closed_at__isnull=True)
        total_deals = deals_qs.count()
        open_deals = open_deals_qs.count()
        won_deals = deals_qs.filter(won=True).count()
        lost_deals = deals_qs.filter(closed_at__isnull=False, won=False).count()
        stale_open_deals = open_deals_qs.filter(updated_at__lt=overdue_threshold).count()

        pipeline_value = open_deals_qs.aggregate(total=Sum('value'))['total'] or 0
        weighted_forecast = open_deals_qs.aggregate(total=Sum('weighted_value'))['total'] or 0

        closed_deals = won_deals + lost_deals
        win_rate = (won_deals / closed_deals * 100) if closed_deals else 0.0

        stage_breakdown = []
        for row in (
            open_deals_qs.values('stage__id', 'stage__name')
            .annotate(
                count=Count('id'),
                value_sum=Sum('value'),
                weighted_sum=Sum('weighted_value'),
            )
            .order_by('-value_sum', '-count')
        ):
            stage_breakdown.append({
                'stage_id': row['stage__id'],
                'stage_name': row['stage__name'] or 'Unassigned',
                'deal_count': row['count'],
                'pipeline_value': float(row['value_sum'] or 0),
                'weighted_value': float(row['weighted_sum'] or 0),
            })

        source_breakdown = []
        for row in (
            leads_qs.values('source__name')
            .annotate(count=Count('id'))
            .order_by('-count', 'source__name')[:8]
        ):
            source_breakdown.append({
                'source_name': row['source__name'] or 'Direct',
                'lead_count': row['count'],
            })

        owner_breakdown = []
        for row in (
            leads_qs.values('responsible_person__id', 'responsible_person__username')
            .annotate(lead_count=Count('id'))
            .order_by('-lead_count', 'responsible_person__username')[:8]
        ):
            owner_breakdown.append({
                'user_id': row['responsible_person__id'],
                'username': row['responsible_person__username'] or 'unassigned',
                'lead_count': row['lead_count'],
            })

        overdue_tasks = activities_qs.filter(
            activity_type='task',
            completed=False,
            due_date__lt=now,
        ).count()
        due_today_tasks = activities_qs.filter(
            activity_type='task',
            completed=False,
            due_date__date=now.date(),
        ).count()
        completed_tasks_last_7d = activities_qs.filter(
            activity_type='task',
            completed=True,
            completed_at__gte=now - timedelta(days=7),
        ).count()

        recent_activities = []
        for activity in activities_qs.order_by('-created_at')[:12]:
            recent_activities.append({
                'id': activity.id,
                'lead_id': activity.lead_id,
                'lead_name': activity.lead.full_name if activity.lead else 'Unknown',
                'activity_type': activity.activity_type,
                'subject': activity.subject,
                'created_by': (
                    activity.created_by.username if activity.created_by else 'system'
                ),
                'completed': activity.completed,
                'due_date': activity.due_date.isoformat() if activity.due_date else None,
                'created_at': activity.created_at.isoformat(),
            })

        recommendations = self._build_recommendations(
            conversion_rate=conversion_rate,
            overdue_tasks=overdue_tasks,
            stale_open_deals=stale_open_deals,
            won_deals=won_deals,
            lost_deals=lost_deals,
        )

        return Response({
            'period_days': period_days,
            'generated_at': now.isoformat(),
            'leads': {
                'total': total_leads,
                'new': lead_status_counts.get('new', 0),
                'in_progress': lead_status_counts.get('in_progress', 0),
                'converted': converted_leads,
                'rejected': lead_status_counts.get('rejected', 0),
                'conversion_rate': round(conversion_rate, 2),
                'created_in_period': period_created,
                'converted_in_period': period_converted,
            },
            'deals': {
                'total': total_deals,
                'open': open_deals,
                'won': won_deals,
                'lost': lost_deals,
                'stale_open': stale_open_deals,
                'pipeline_value': float(pipeline_value),
                'weighted_forecast': float(weighted_forecast),
                'win_rate': round(win_rate, 2),
            },
            'activities': {
                'overdue_tasks': overdue_tasks,
                'due_today_tasks': due_today_tasks,
                'completed_tasks_last_7d': completed_tasks_last_7d,
            },
            'stage_breakdown': stage_breakdown,
            'source_breakdown': source_breakdown,
            'owner_breakdown': owner_breakdown,
            'recent_activities': recent_activities,
            'recommendations': recommendations,
        })

    @staticmethod
    def _parse_period_days(raw_period_days):
        try:
            period_days = int(raw_period_days or 30)
        except (TypeError, ValueError):
            period_days = 30
        return max(7, min(period_days, 365))

    @staticmethod
    def _build_recommendations(*, conversion_rate, overdue_tasks, stale_open_deals, won_deals, lost_deals):
        recommendations = []

        if overdue_tasks > 0:
            recommendations.append(
                f"Follow up overdue tasks ({overdue_tasks}) to reduce lead drop-off."
            )
        if stale_open_deals > 0:
            recommendations.append(
                f"Review stale open deals ({stale_open_deals}) and re-qualify stage ownership."
            )
        if conversion_rate < 20:
            recommendations.append(
                "Conversion rate is below 20%; tighten qualification rules and first-contact SLA."
            )
        if (won_deals + lost_deals) >= 10 and won_deals < lost_deals:
            recommendations.append(
                "Losses exceed wins in closed deals; audit stage exit criteria and pricing objections."
            )

        if not recommendations:
            recommendations.append("Pipeline health is stable. Focus on predictable weekly follow-up cadence.")

        return recommendations

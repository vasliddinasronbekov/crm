"""
CRM Activity and Pipeline Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .activity_models import Activity, Pipeline, PipelineStage, Deal
from .activity_serializers import (
    ActivitySerializer, ActivityCreateSerializer,
    PipelineSerializer, PipelineStageSerializer,
    DealSerializer, DealCreateSerializer, DealMoveStageSerializer
)


class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Activity CRUD operations

    Endpoints:
    - GET /api/v1/crm/activities/ - List all activities
    - GET /api/v1/crm/activities/?lead=1 - Filter by lead
    - POST /api/v1/crm/activities/ - Create activity
    - PATCH /api/v1/crm/activities/{id}/ - Update activity
    - POST /api/v1/crm/activities/{id}/complete/ - Mark as complete
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['lead', 'activity_type', 'completed', 'priority', 'assigned_to']
    search_fields = ['subject', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        return Activity.objects.select_related('lead', 'created_by', 'assigned_to').all()

    def get_serializer_class(self):
        if self.action == 'create':
            return ActivityCreateSerializer
        return ActivitySerializer

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark activity as completed"""
        activity = self.get_object()
        activity.mark_complete()
        serializer = self.get_serializer(activity)
        return Response(serializer.data)


class PipelineViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Pipeline CRUD operations

    Endpoints:
    - GET /api/v1/crm/pipelines/ - List all pipelines
    - POST /api/v1/crm/pipelines/ - Create pipeline
    - GET /api/v1/crm/pipelines/{id}/ - Get pipeline details with stages
    """
    queryset = Pipeline.objects.prefetch_related('stages').all()
    serializer_class = PipelineSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active', 'is_default']
    ordering = ['-is_default', 'name']


class PipelineStageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PipelineStage CRUD operations

    Endpoints:
    - GET /api/v1/crm/pipeline-stages/ - List all stages
    - GET /api/v1/crm/pipeline-stages/?pipeline=1 - Filter by pipeline
    - POST /api/v1/crm/pipeline-stages/ - Create stage
    """
    queryset = PipelineStage.objects.select_related('pipeline').all()
    serializer_class = PipelineStageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['pipeline', 'is_active']
    ordering = ['pipeline', 'order']


class DealViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Deal CRUD operations

    Endpoints:
    - GET /api/v1/crm/deals/ - List all deals
    - GET /api/v1/crm/deals/?pipeline=1 - Filter by pipeline
    - GET /api/v1/crm/deals/?stage=1 - Filter by stage
    - POST /api/v1/crm/deals/ - Create deal
    - PATCH /api/v1/crm/deals/{id}/move_stage/ - Move to new stage
    - POST /api/v1/crm/deals/{id}/win/ - Mark as won
    - POST /api/v1/crm/deals/{id}/lose/ - Mark as lost
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['pipeline', 'stage', 'won']
    ordering_fields = ['created_at', 'value', 'expected_close_date']
    ordering = ['-created_at']

    def get_queryset(self):
        return Deal.objects.select_related('lead', 'pipeline', 'stage').all()

    def get_serializer_class(self):
        if self.action == 'create':
            return DealCreateSerializer
        elif self.action == 'move_stage':
            return DealMoveStageSerializer
        return DealSerializer

    @action(detail=True, methods=['patch'])
    def move_stage(self, request, pk=None):
        """Move deal to new stage"""
        deal = self.get_object()
        serializer = DealMoveStageSerializer(data=request.data)

        if serializer.is_valid():
            new_stage = PipelineStage.objects.get(id=serializer.validated_data['stage_id'])
            deal.move_to_stage(new_stage)
            return Response(DealSerializer(deal).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def win(self, request, pk=None):
        """Mark deal as won"""
        deal = self.get_object()
        deal.mark_won()
        return Response(DealSerializer(deal).data)

    @action(detail=True, methods=['post'])
    def lose(self, request, pk=None):
        """Mark deal as lost"""
        deal = self.get_object()
        reason = request.data.get('reason', '')
        deal.mark_lost(reason)
        return Response(DealSerializer(deal).data)

# /mnt/usb/edu-api-project/core/views.py
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from .models import Region, Comment
from .serializers import RegionSerializer, CommentSerializer

# Health Check and Monitoring
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from django.core.cache import cache
from django.conf import settings
from django.db.models import Q
import sys
import os


class RegionViewSet(viewsets.ModelViewSet):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]


@require_http_methods(["GET"])
@csrf_exempt
def health_check(request):
    """
    Health check endpoint for monitoring and load balancers
    Returns 200 if system is healthy, 503 if degraded

    GET /api/health/
    """
    health_status = {
        "status": "healthy",
        "version": "1.1.0",
        "checks": {}
    }

    all_healthy = True

    # Check database connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        all_healthy = False

    # Check Redis/cache connectivity
    try:
        cache.set('health_check', 'ok', 10)
        if cache.get('health_check') == 'ok':
            health_status["checks"]["cache"] = "healthy"
        else:
            health_status["checks"]["cache"] = "unhealthy: cache read failed"
            all_healthy = False
    except Exception as e:
        health_status["checks"]["cache"] = f"unhealthy: {str(e)}"
        all_healthy = False

    # Check disk space
    try:
        stat = os.statvfs('/')
        free_space_gb = (stat.f_bavail * stat.f_frsize) / (1024 ** 3)

        if free_space_gb < 1:  # Less than 1GB free
            health_status["checks"]["disk_space"] = f"warning: {free_space_gb:.2f}GB free"
        else:
            health_status["checks"]["disk_space"] = f"healthy: {free_space_gb:.2f}GB free"
    except Exception as e:
        health_status["checks"]["disk_space"] = f"unknown: {str(e)}"

    # Overall status
    if not all_healthy:
        health_status["status"] = "degraded"
        return JsonResponse(health_status, status=503)

    return JsonResponse(health_status, status=200)


@require_http_methods(["GET"])
@csrf_exempt
def liveness_check(request):
    """
    Liveness check for Kubernetes/container orchestration
    Returns 200 if application is running

    GET /api/alive/
    """
    return JsonResponse({"alive": True}, status=200)


@require_http_methods(["GET"])
@csrf_exempt
def readiness_check(request):
    """
    Readiness check for Kubernetes/container orchestration
    Returns 200 when app is ready to serve traffic

    GET /api/ready/
    """
    try:
        # Quick database check
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"ready": True}, status=200)
    except Exception as e:
        return JsonResponse({
            "ready": False,
            "reason": str(e)
        }, status=503)


@extend_schema(
    responses=OpenApiTypes.OBJECT,
    description="Global search across users, groups, and courses."
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """
    Global search across students, teachers, groups, and courses

    GET /api/v1/search/?query=search_term

    Returns:
    {
        "students": [...],
        "teachers": [...],
        "groups": [...],
        "courses": [...]
    }
    """
    query = request.query_params.get('query', '').strip()

    if not query:
        return Response({
            "students": [],
            "teachers": [],
            "groups": [],
            "courses": []
        })

    # Limit to 10 results per category
    limit = 10

    results = {
        "students": [],
        "teachers": [],
        "groups": [],
        "courses": []
    }

    try:
        # Import models here to avoid circular imports
        from users.models import User
        from student_profile.models import Group, Course

        # Search students (users who are NOT teachers and NOT staff)
        students = User.objects.filter(
            Q(is_teacher=False, is_staff=False) & (
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(phone__icontains=query)
            )
        )[:limit]

        results["students"] = [{
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email,
            "phone": user.phone,
            "photo": user.photo.url if user.photo else None,
        } for user in students]

        # Search teachers (users who are teachers)
        teachers = User.objects.filter(
            Q(is_teacher=True) & (
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(username__icontains=query) |
                Q(email__icontains=query) |
                Q(phone__icontains=query)
            )
        )[:limit]

        results["teachers"] = [{
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email,
            "phone": user.phone,
            "photo": user.photo.url if user.photo else None,
        } for user in teachers]

        # Search groups
        groups = Group.objects.filter(
            Q(name__icontains=query)
        ).select_related('course', 'main_teacher')[:limit]

        results["groups"] = [{
            "id": group.id,
            "name": group.name,
            "course": group.course.name if group.course else None,
            "teacher": f"{group.main_teacher.first_name} {group.main_teacher.last_name}".strip() if group.main_teacher else None,
            "students_count": group.students.count() if hasattr(group, 'students') else 0,
        } for group in groups]

        # Search courses
        courses = Course.objects.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query)
        )[:limit]

        results["courses"] = [{
            "id": course.id,
            "name": course.name,
            "description": course.description,
            "cefr_level": course.cefr_level.name if hasattr(course, 'cefr_level') and course.cefr_level else None,
        } for course in courses]

    except Exception as e:
        # Log error but return empty results to avoid breaking the frontend
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Search error: {str(e)}")

    return Response(results)

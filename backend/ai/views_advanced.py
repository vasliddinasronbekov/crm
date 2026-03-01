"""
Advanced AI Views

API endpoints for:
- RAG-based Q&A
- Content Generation
- Predictive Analytics
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes

from django.shortcuts import get_object_or_404

from student_profile.models import Lesson, Course
from users.models import User

from .services.rag_service import get_rag_service
from .services.content_generator import get_content_generator
from .services.predictive_analytics import get_predictive_analytics


class RAGQueryView(APIView):
    """
    RAG-based Question Answering

    POST /api/v1/ai/rag/ask/
    Body: {
        "question": "What is...?",
        "course_id": 123 (optional),
        "language": "en" (optional)
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = request.data.get('question')
        course_id = request.data.get('course_id')
        language = request.data.get('language')

        if not question:
            return Response(
                {'error': 'Question is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            rag_service = get_rag_service()
            result = rag_service.ask_question(
                question=question,
                course_id=course_id,
                language=language
            )

            return Response(result)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RAGIndexView(APIView):
    """
    Index course content for RAG

    POST /api/v1/ai/rag/index/
    Body: {
        "course_id": 123 (optional, indexes all if not provided)
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Only allow staff/teachers to index
        if not (request.user.is_staff or request.user.is_teacher):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        course_id = request.data.get('course_id')

        try:
            rag_service = get_rag_service()
            num_indexed = rag_service.index_course_content(course_id)

            return Response({
                'success': True,
                'documents_indexed': num_indexed,
                'message': f'Successfully indexed {num_indexed} documents'
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ContentGeneratorView(APIView):
    """
    Generate quiz questions from lesson

    POST /api/v1/ai/content/generate-quiz/
    Body: {
        "lesson_id": 123,
        "num_questions": 5,
        "difficulty": "medium",
        "language": "en",
        "auto_save": false
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Only allow staff/teachers
        if not (request.user.is_staff or request.user.is_teacher):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        lesson_id = request.data.get('lesson_id')
        num_questions = request.data.get('num_questions', 5)
        difficulty = request.data.get('difficulty', 'medium')
        language = request.data.get('language')
        auto_save = request.data.get('auto_save', False)

        if not lesson_id:
            return Response(
                {'error': 'lesson_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lesson = get_object_or_404(Lesson, id=lesson_id)
            content_generator = get_content_generator()

            quiz_data = content_generator.create_quiz_from_lesson(
                lesson=lesson,
                num_questions=num_questions,
                auto_save=auto_save
            )

            if 'error' in quiz_data:
                return Response(quiz_data, status=status.HTTP_400_BAD_REQUEST)

            return Response(quiz_data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateSummaryView(APIView):
    """
    Generate summary of lesson content

    POST /api/v1/ai/content/generate-summary/
    Body: {
        "lesson_id": 123,
        "max_length": 200,
        "language": "en"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        max_length = request.data.get('max_length', 200)
        language = request.data.get('language')

        if not lesson_id:
            return Response(
                {'error': 'lesson_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lesson = get_object_or_404(Lesson, id=lesson_id)
            content_generator = get_content_generator()

            content = f"{lesson.title}\n{lesson.description or ''}\n{lesson.content or ''}"
            summary = content_generator.generate_summary(
                content=content,
                max_length=max_length,
                language=language
            )

            return Response({
                'lesson_id': lesson.id,
                'lesson_title': lesson.title,
                'summary': summary,
                'original_length': len(content.split()),
                'summary_length': len(summary.split())
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DropoutRiskView(APIView):
    """
    Calculate dropout risk for student

    GET /api/v1/ai/analytics/dropout-risk/
    or
    GET /api/v1/ai/analytics/dropout-risk/{student_id}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id=None):
        # If student_id not provided, use current user
        if student_id:
            # Only staff can check other students
            if not (request.user.is_staff or request.user.is_teacher):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
            student = get_object_or_404(User, id=student_id)
        else:
            student = request.user

        try:
            analytics = get_predictive_analytics()
            risk_data = analytics.calculate_dropout_risk(student)

            return Response({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                **risk_data
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PerformanceForecastView(APIView):
    """
    Forecast student performance

    GET /api/v1/ai/analytics/performance-forecast/
    Query params: days_ahead (default: 30)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id=None):
        if student_id:
            if not (request.user.is_staff or request.user.is_teacher):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
            student = get_object_or_404(User, id=student_id)
        else:
            student = request.user

        days_ahead = int(request.query_params.get('days_ahead', 30))

        try:
            analytics = get_predictive_analytics()
            forecast = analytics.forecast_performance(student, days_ahead)

            return Response({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                **forecast
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StudyRecommendationView(APIView):
    """
    Get personalized study recommendations

    GET /api/v1/ai/analytics/study-recommendations/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student = request.user

        try:
            analytics = get_predictive_analytics()
            recommendations = analytics.recommend_study_time(student)

            return Response({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                **recommendations
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InterventionTriggersView(APIView):
    """
    Get intervention triggers for student

    GET /api/v1/ai/analytics/intervention-triggers/{student_id}/
    (Staff/Teacher only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        if not (request.user.is_staff or request.user.is_teacher):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        student = get_object_or_404(User, id=student_id)

        try:
            analytics = get_predictive_analytics()
            triggers = analytics.get_intervention_triggers(student)

            return Response({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'triggers': triggers,
                'requires_intervention': len(triggers) > 0
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_dashboard(request):
    """
    Complete AI dashboard for student

    GET /api/v1/ai/dashboard/
    """
    student = request.user

    try:
        analytics = get_predictive_analytics()

        # Get all analytics
        dropout_risk = analytics.calculate_dropout_risk(student)
        performance_forecast = analytics.forecast_performance(student)
        study_recommendations = analytics.recommend_study_time(student)

        dashboard_data = {
            'student_id': student.id,
            'student_name': student.get_full_name(),
            'dropout_risk': {
                'score': dropout_risk['risk_score'],
                'level': dropout_risk['risk_level'],
                'top_factors': dropout_risk['risk_factors'][:3]
            },
            'performance_forecast': {
                'current': performance_forecast['current_average'],
                'predicted': performance_forecast['predicted_score'],
                'trend': performance_forecast['trend']
            },
            'study_recommendations': {
                'daily_minutes': study_recommendations['daily_minutes'],
                'focus_areas': study_recommendations['focus_areas'],
                'priority_topics': study_recommendations['priority_topics'][:3]
            }
        }

        return Response(dashboard_data)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

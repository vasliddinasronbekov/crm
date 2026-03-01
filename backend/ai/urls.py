# ai/urls.py
from django.urls import path
from .views import (
    stt_view, stt_async_view, intent_view, apply_intent, tts_view,
    voice_navigation_view, voice_commands_list_view, hybrid_chat_view,
    unified_ai_command_view
)
# Temporarily commented out until langchain and dependencies are installed
# from .views_advanced import (
#     RAGQueryView, RAGIndexView,
#     ContentGeneratorView, GenerateSummaryView,
#     DropoutRiskView, PerformanceForecastView,
#     StudyRecommendationView, InterventionTriggersView,
#     ai_dashboard
# )

urlpatterns = [
    # Speech-to-Text
    path("stt/", stt_view, name="stt"),
    path("stt/async/", stt_async_view, name="stt_async"),

    # Text-to-Speech
    path("tts/", tts_view, name="tts"),

    # Intent Processing
    path("intent/", intent_view, name="intent"),
    path("apply_intent/", apply_intent, name="apply_intent"),

    # Voice Navigation
    path("voice-navigation/", voice_navigation_view, name="voice_navigation"),
    path("voice-commands/", voice_commands_list_view, name="voice_commands"),

    # Hybrid AI Chat
    path("chat/", hybrid_chat_view, name="hybrid_chat"),

    # Unified AI Command - MAIN ENDPOINT
    path("voice-command/", unified_ai_command_view, name="unified_ai_command"),

    # === Advanced AI Features ===
    # Temporarily commented out until langchain and dependencies are installed

    # # RAG (Retrieval Augmented Generation)
    # path("rag/ask/", RAGQueryView.as_view(), name="rag_ask"),
    # path("rag/index/", RAGIndexView.as_view(), name="rag_index"),

    # # Content Generation
    # path("content/generate-quiz/", ContentGeneratorView.as_view(), name="generate_quiz"),
    # path("content/generate-summary/", GenerateSummaryView.as_view(), name="generate_summary"),

    # # Predictive Analytics
    # path("analytics/dropout-risk/", DropoutRiskView.as_view(), name="dropout_risk"),
    # path("analytics/dropout-risk/<int:student_id>/", DropoutRiskView.as_view(), name="dropout_risk_student"),
    # path("analytics/performance-forecast/", PerformanceForecastView.as_view(), name="performance_forecast"),
    # path("analytics/performance-forecast/<int:student_id>/", PerformanceForecastView.as_view(), name="performance_forecast_student"),
    # path("analytics/study-recommendations/", StudyRecommendationView.as_view(), name="study_recommendations"),
    # path("analytics/intervention-triggers/<int:student_id>/", InterventionTriggersView.as_view(), name="intervention_triggers"),

    # # AI Dashboard (Combined Analytics)
    # path("dashboard/", ai_dashboard, name="ai_dashboard"),
]

# /mnt/usb/edu-api-project/edu_project/urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# --- Barcha View'larni TO'G'RI joydan import qilamiz ---

# `users` app'idan
from users.views import (
    UserViewSet, StudentViewSet, TeacherViewSet, MyTokenObtainPairView,
    UserProfileView, ChangePasswordView, LogoutView
)
from rest_framework_simplejwt.views import TokenRefreshView

# `task` app'idan
from task.views import TaskBulkCreateView, AutoTaskViewSet, BoardViewSet, ListViewSet, TaskViewSet
from task.certificate_views import CertificateViewSet, CertificateTemplateViewSet, CertificateVerificationViewSet

# `student_profile` app'idan
from student_profile.views import (
    BranchViewSet, GroupViewSet, AttendanceViewSet, EventViewSet, PurchaseWithCoinsView,
    ExamScoreViewSet, ShopProductViewSet, ShopOrderViewSet,
    PaymentViewSet, StoryViewSet, StudentCoinsViewSet,
    TicketViewSet, TicketChatViewSet, CourseViewSet, RoomViewSet,
    ExpenseTypeViewSet, ExpenseViewSet, LeaveReasonViewSet, InformationViewSet,
    StudentStatisticsView, StudentUpdateView, CreatePaymentView, PaymentCallbackView,
    PaymentTypeViewSet, AutomaticFineViewSet, AssistantSlotViewSet, BookingViewSet,
)
from student_profile.content_views import (
    CourseModuleViewSet, LessonViewSet, StudentProgressViewSet,
    VideoWatchLogViewSet, LessonNoteViewSet, CourseAnnouncementViewSet
)
from student_profile.quiz_views import (
    AssignmentViewSet, AssignmentSubmissionViewSet,
    QuizViewSet, QuestionViewSet, QuizAttemptViewSet, QuizAnswerViewSet
)

# `crm` app'idan
from crm.views import (
    SourceViewSet, LeadDepartmentViewSet,
    SubDepartmentViewSet, LeadViewSet
)
from crm.activity_views import (
    ActivityViewSet, PipelineViewSet, PipelineStageViewSet, DealViewSet
)

# `messaging` app'idan
from messaging.views import MessageTemplateViewSet, SmsHistoryViewSet, SendMessageView, AutomaticMessageViewSet
from messaging.email_views import EmailTemplateViewSet, EmailCampaignViewSet, EmailLogViewSet, AutomatedEmailViewSet

# `hr` app'idan
from hr.views import TeacherSalaryViewSet, SalaryViewSet

# `core` app'idan
from core.views import RegionViewSet, CommentViewSet, health_check, liveness_check, readiness_check, global_search

# `analytics` app'idan
from analytics.views import AnalyticsView, LeaderboardView, DashboardStatsView, ReportListView


# --- Markaziy Router ---
router = DefaultRouter()

# `users`, `student`, `teacher` endpoint'lari
router.register(r'task/users', UserViewSet, basename='user')
router.register(r'users/students', StudentViewSet, basename='students')  # For frontend
router.register(r'v1/student', StudentViewSet, basename='student')
router.register(r'users/teachers', TeacherViewSet, basename='teachers')  # For frontend
router.register(r'task/teachers', TeacherViewSet, basename='teacher')

# `student_profile` va boshqa modullar uchun endpoint'lar
router.register(r'v1/super_user/branch', BranchViewSet, basename='branch')
router.register(r'crm/branches', BranchViewSet, basename='branches')  # For frontend
router.register(r'v1/mentor/group', GroupViewSet, basename='group')
router.register(r'student-profile/groups', GroupViewSet, basename='groups')  # For frontend
router.register(r'v1/payment', PaymentViewSet, basename='payment')
router.register(r'v1/mentor/attendance', AttendanceViewSet, basename='attendance')
router.register(r'student-profile/attendance', AttendanceViewSet, basename='attendance-v2')  # For frontend
router.register(r'v1/student-bonus', StudentCoinsViewSet, basename='student-bonus')
router.register(r'v1/exam-detail', ExamScoreViewSet, basename='exam-detail')
router.register(r'student-profile/exam-scores', ExamScoreViewSet, basename='exam-scores')  # For frontend
router.register(r'v1/notification', TicketViewSet, basename='notification')
router.register(r'v1/course', CourseViewSet, basename='course')
router.register(r'student-profile/courses', CourseViewSet, basename='courses')  # For frontend
router.register(r'v1/room', RoomViewSet, basename='room')
router.register(r'crm/rooms', RoomViewSet, basename='rooms')  # For frontend
router.register(r'v1/expense-type', ExpenseTypeViewSet, basename='expense-type')
router.register(r'v1/expense', ExpenseViewSet, basename='expense')
router.register(r'v1/leave-reason', LeaveReasonViewSet, basename='leave-reason')
router.register(r'v1/information', InformationViewSet, basename='information')
router.register(r'v1/payment-type', PaymentTypeViewSet, basename='payment-type')
router.register(r'v1/automatic-fine', AutomaticFineViewSet, basename='automatic-fine')
router.register(r'v1/student-profile/events', EventViewSet, basename='event')
router.register(r'v1/student-profile/product', ShopProductViewSet, basename='product')
router.register(r'v1/student-profile/order', ShopOrderViewSet, basename='order')
router.register(r'v1/student-profile/stories', StoryViewSet, basename='story')
router.register(r'v1/student-profile/ticket/tickets', TicketViewSet, basename='ticket')
router.register(r'v1/student-profile/ticket/ticket-chats', TicketChatViewSet, basename='ticketchat')

# `crm` moduli endpoint'lari
router.register(r'v1/source', SourceViewSet, basename='source')
router.register(r'v1/lead-department', LeadDepartmentViewSet, basename='lead-department')
router.register(r'v1/sub-department', SubDepartmentViewSet, basename='sub-department')
router.register(r'v1/lead', LeadViewSet, basename='lead')
router.register(r'crm/leads', LeadViewSet, basename='leads')  # For frontend
router.register(r'v1/crm/activities', ActivityViewSet, basename='activity')
router.register(r'crm/activities', ActivityViewSet, basename='activities')  # For frontend
router.register(r'v1/crm/pipelines', PipelineViewSet, basename='pipeline')
router.register(r'crm/pipelines', PipelineViewSet, basename='pipelines')  # For frontend
router.register(r'v1/crm/pipeline-stages', PipelineStageViewSet, basename='pipeline-stage')
router.register(r'v1/crm/deals', DealViewSet, basename='deal')
router.register(r'crm/deals', DealViewSet, basename='deals')  # For frontend

# `messaging` moduli endpoint'lari
router.register(r'v1/message-template', MessageTemplateViewSet, basename='message-template')
router.register(r'v1/sms-history', SmsHistoryViewSet, basename='sms-history')
router.register(r'messaging/messages', SmsHistoryViewSet, basename='messages')  # For frontend
router.register(r'messaging/notifications', SmsHistoryViewSet, basename='notifications')  # For frontend (temporary)
router.register(r'v1/automatic-message', AutomaticMessageViewSet, basename='automatic-message')

# Email Marketing endpoints
router.register(r'v1/email/templates', EmailTemplateViewSet, basename='email-template')
router.register(r'v1/email/campaigns', EmailCampaignViewSet, basename='email-campaign')
router.register(r'v1/email/logs', EmailLogViewSet, basename='email-log')
router.register(r'v1/email/automated', AutomatedEmailViewSet, basename='automated-email')

# `hr` moduli endpoint'lari
router.register(r'v1/teacher-salary', TeacherSalaryViewSet, basename='teacher-salary')
router.register(r'v1/mentor/salary', SalaryViewSet, basename='salary')

# `core` moduli endpoint'lari
router.register(r'v1/region', RegionViewSet, basename='region')
router.register(r'v1/comment', CommentViewSet, basename='comment')

# Content Delivery (LMS) endpoints
router.register(r'v1/lms/modules', CourseModuleViewSet, basename='course-module')
router.register(r'v1/lms/lessons', LessonViewSet, basename='lesson')
router.register(r'v1/lms/progress', StudentProgressViewSet, basename='student-progress')
router.register(r'v1/lms/video-logs', VideoWatchLogViewSet, basename='video-watch-log')
router.register(r'v1/lms/notes', LessonNoteViewSet, basename='lesson-note')
router.register(r'v1/lms/announcements', CourseAnnouncementViewSet, basename='course-announcement')

# Quiz & Assignment endpoints
router.register(r'v1/lms/assignments', AssignmentViewSet, basename='assignment')
router.register(r'v1/lms/assignment-submissions', AssignmentSubmissionViewSet, basename='assignment-submission')
router.register(r'v1/lms/quizzes', QuizViewSet, basename='quiz')
router.register(r'v1/lms/questions', QuestionViewSet, basename='question')
router.register(r'v1/lms/quiz-attempts', QuizAttemptViewSet, basename='quiz-attempt')
router.register(r'v1/lms/quiz-answers', QuizAnswerViewSet, basename='quiz-answer')

# --- Asosiy urlpatterns ---
urlpatterns = [
    # AI
    path("api/v1/ai/", include("ai.urls")),

    # Gamification
    path("api/gamification/", include("gamification.urls")),

    # Social Learning
    path("api/social/", include("social.urls")),

    # Subscriptions & Payments
    path("api/subscriptions/", include("subscriptions.urls")),
    path('api/messaging/', include('messaging.urls')),

    path('admin/', admin.site.urls),

    # Barcha router URL'lari /api/ ostida
    path('api/', include(router.urls)),

    # --- AUTHENTICATION ENDPOINTS ---
    path('api/task/', include('task.urls')),
    path('api/auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/student-profile/login/', MyTokenObtainPairView.as_view(), name='student_token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/profile/', UserProfileView.as_view(), name='user_profile'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    
    # Maxsus, routerga kirmaydigan URL'lar

    path('api/v1/student-profile/student/statistics/', StudentStatisticsView.as_view(), name='student-statistics'),
    path('api/v1/student-profile/student/update/', StudentUpdateView.as_view(), name='student-update'),
    path('api/v1/student-profile/payment/create/', CreatePaymentView.as_view(), name='payment-create'),
    path('api/v1/payment/callback/', PaymentCallbackView.as_view(), name='payment-callback'),
    path('api/v1/send-message/', SendMessageView.as_view(), name='send-message'),

    # --- ANALYTICS ENDPOINTS ---
    path('api/v1/super_user/analytics/', AnalyticsView.as_view(), name='analytics'),
    path('api/analytics/', AnalyticsView.as_view(), name='analytics-v2'),
    path('api/analytics/dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('api/analytics/reports/', ReportListView.as_view(), name='reports-list'),
    path('api/analytics/reports/generate/', ReportListView.as_view(), name='reports-generate'),
    path('api/v1/ranking/leaderboard/', LeaderboardView.as_view(), name='leaderboard'),

    path('shop/purchase/', PurchaseWithCoinsView.as_view(), name='shop-purchase'),
    # API Hujjatlari uchun URL'lar
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    # Student Profile
    path('api/v1/student-profile/', include('student_profile.urls')),

    # Global Search Endpoint
    path('api/v1/search/', global_search, name='global-search'),

    # Health Check & Monitoring Endpoints
    path('api/health/', health_check, name='health-check'),
    path('api/alive/', liveness_check, name='liveness-check'),
    path('api/ready/', readiness_check, name='readiness-check'),

]

# Rasm va fayllarni development rejimida ko'rsatish uchun
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

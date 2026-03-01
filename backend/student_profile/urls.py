# /mnt/usb/edu-api-project/student_profile/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BranchViewSet, GroupViewSet, AttendanceViewSet, EventViewSet,
    ExamScoreViewSet, ShopProductViewSet, ShopOrderViewSet,
    PaymentViewSet, StoryViewSet, StudentCoinsViewSet,
    TicketViewSet, TicketChatViewSet, StudentStatisticsView,
    StudentUpdateView, AvailableSlotsView, BookSlotView,BookingHistoryView,
    UpcomingBookingView, PaymentReceiptView, PaymentTypeViewSet, CourseViewSet, RoomViewSet
    )

# Import accounting views
from .accounting_views import (
    StudentAccountViewSet,
    MonthlySubscriptionChargeViewSet,
    AccountingActivityLogViewSet,
    RealtimeAccountingDashboardView,
    StudentBalanceViewSet,
    TeacherEarningsViewSet,
    StudentFineViewSet,
    FinancialSummaryViewSet,
    AccountTransactionViewSet
)

# Import report and reminder views
from .report_views import (
    ScheduledReportViewSet,
    ReportGenerationViewSet,
    PaymentReminderSettingsViewSet,
    PaymentReminderViewSet,
    BulkPaymentReminderView,
    PendingPaymentsForRemindersView
)

# Import IELTS views
from .ielts_views import (
    IELTSExamViewSet,
    IELTSAttemptViewSet,
    IELTSAnswerViewSet
)

# Import exam draft and notification views
from .exam_draft_views import (
    IELTSExamDraftViewSet,
    IELTSQuestionDraftViewSet,
    AIExamGenerationViewSet,
    NotificationViewSet,
    InboxSettingsViewSet
)

# Import SAT views
from .sat_views import (
    SATExamViewSet,
    SATModuleViewSet,
    SATQuestionViewSet,
    SATAttemptViewSet,
    SATAnswerViewSet
)

router = DefaultRouter()
# Har bir ViewSet uchun URL manzilini ro'yxatdan o'tkazamiz
router.register(r'branch', BranchViewSet, basename='branch')
router.register(r'group', GroupViewSet, basename='group')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'events', EventViewSet, basename='event')
router.register(r'exam-score', ExamScoreViewSet, basename='examscore')
router.register(r'product', ShopProductViewSet, basename='product')
router.register(r'order', ShopOrderViewSet, basename='order')
router.register(r'payment', PaymentViewSet, basename='payment')
router.register(r'payment-types', PaymentTypeViewSet, basename='payment-type')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'stories', StoryViewSet, basename='story')
router.register(r'student-coins', StudentCoinsViewSet, basename='studentcoins')
router.register(r'ticket/tickets', TicketViewSet, basename='ticket')
router.register(r'ticket/ticket-chats', TicketChatViewSet, basename='ticketchat')

# Accounting endpoints
router.register(r'accounting/student-accounts', StudentAccountViewSet, basename='student-account')
router.register(r'accounting/monthly-charges', MonthlySubscriptionChargeViewSet, basename='monthly-charge')
router.register(r'accounting/activity-logs', AccountingActivityLogViewSet, basename='accounting-activity-log')
router.register(r'accounting/student-balances', StudentBalanceViewSet, basename='student-balance')
router.register(r'accounting/teacher-earnings', TeacherEarningsViewSet, basename='teacher-earning')
router.register(r'accounting/student-fines', StudentFineViewSet, basename='student-fine')
router.register(r'accounting/financial-summaries', FinancialSummaryViewSet, basename='financial-summary')
router.register(r'accounting/transactions', AccountTransactionViewSet, basename='transaction')

# Report scheduling and reminder endpoints
router.register(r'reports/scheduled-reports', ScheduledReportViewSet, basename='scheduled-report')
router.register(r'reports/report-generations', ReportGenerationViewSet, basename='report-generation')
router.register(r'reports/reminder-settings', PaymentReminderSettingsViewSet, basename='reminder-settings')
router.register(r'reports/payment-reminders', PaymentReminderViewSet, basename='payment-reminder')

# IELTS exam endpoints
router.register(r'ielts/exams', IELTSExamViewSet, basename='ielts-exam')
router.register(r'ielts/attempts', IELTSAttemptViewSet, basename='ielts-attempt')
router.register(r'ielts/answers', IELTSAnswerViewSet, basename='ielts-answer')

# IELTS exam draft and approval endpoints
router.register(r'exam-drafts', IELTSExamDraftViewSet, basename='exam-draft')
router.register(r'question-drafts', IELTSQuestionDraftViewSet, basename='question-draft')
router.register(r'ai-exam-generate', AIExamGenerationViewSet, basename='ai-exam-generate')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'inbox-settings', InboxSettingsViewSet, basename='inbox-settings')

# SAT 2025 exam endpoints
router.register(r'sat/exams', SATExamViewSet, basename='sat-exam')
router.register(r'sat/modules', SATModuleViewSet, basename='sat-module')
router.register(r'sat/questions', SATQuestionViewSet, basename='sat-question')
router.register(r'sat/attempts', SATAttemptViewSet, basename='sat-attempt')
router.register(r'sat/answers', SATAnswerViewSet, basename='sat-answer')

# ... va hokazo, spetsifikatsiyadagi barcha endpoint'lar uchun

urlpatterns = [
    # Maxsus URL'lar
    path('student/statistics/', StudentStatisticsView.as_view(), name='student-statistics'),
    path('student/update/', StudentUpdateView.as_view(), name='student-update'), # <--- YANGI URL
# --- ASSISTANT BOOKING URL'LARI ---
    path('assistant/available-slots/', AvailableSlotsView.as_view(), name='available-slots'),
    path('assistant/book-slot/', BookSlotView.as_view(), name='book-slot'),
    path('assistant/booking/history/', BookingHistoryView.as_view(), name='booking-history'),
    path('assistant/upcoming-slot/', UpcomingBookingView.as_view(), name='upcoming-booking'),
    path('payment/<int:payment_id>/receipt/', PaymentReceiptView.as_view(), name='payment-receipt'),
    path('accounting/realtime-dashboard/', RealtimeAccountingDashboardView.as_view(), name='accounting-realtime-dashboard'),

    # Report and reminder custom endpoints
    path('reports/bulk-reminders/', BulkPaymentReminderView.as_view(), name='bulk-reminders'),
    path('reports/pending-payments/', PendingPaymentsForRemindersView.as_view(), name='pending-payments'),

    # --- QAYTA TIKLANGAN ASSISTANT BOOKING URL'LARI ---
    path('assistant/available-slots/', AvailableSlotsView.as_view(), name='available-slots'),
    path('assistant/book-slot/', BookSlotView.as_view(), name='book-slot'),
    path('assistant/booking/history/', BookingHistoryView.as_view(), name='booking-history'),
    path('assistant/upcoming-slot/', UpcomingBookingView.as_view(), name='upcoming-booking'),
    # Router tomonidan generatsiya qilingan URL'lar
    path('', include(router.urls)),
]

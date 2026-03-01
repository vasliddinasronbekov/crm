#!/usr/bin/env python3
"""
Script to add date range filtering support to all ViewSets in the backend.
This updates single date filtering to also support date_from and date_to parameters.
"""

ATTENDANCE_VIEW_UPDATE = """
    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher:
            # O'qituvchi faqat o'z filialidagi davomatlarni ko'rsin
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(student=user)

        # Date filtering with range support
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.select_related('student', 'group').order_by('-date')
"""

EVENT_VIEW_UPDATE = """
    def get_queryset(self):
        queryset = Event.objects.all()

        # Date filtering with range support - filter by event time date
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(time__date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(time__date__gte=date_from, time__date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(time__date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(time__date__lte=date_to)

        return queryset.order_by('-time')
"""

EXAM_SCORE_VIEW_UPDATE = """
    def get_queryset(self):
        user = self.request.user
        queryset = ExamScore.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher:
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(student=user)

        # Date filtering with range support
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.select_related('student', 'group').order_by('-date')
"""

PAYMENT_VIEW_UPDATE = """
    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_teacher:
            if user.branch:
                queryset = queryset.filter(group__branch=user.branch)
        else:
            queryset = queryset.filter(by_user=user)

        # Date filtering with range support
        date_param = self.request.query_params.get('date', None)
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)

        if date_param:
            queryset = queryset.filter(date=date_param)
        elif date_from and date_to:
            queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
        elif date_from:
            queryset = queryset.filter(date__gte=date_from)
        elif date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.select_related('by_user', 'group', 'payment_type').order_by('-date')
"""

print("""
✅ Date Range Filtering Pattern
================================

This pattern should be applied to all ViewSets that currently have date filtering.

The pattern replaces single date filtering with support for date ranges:

BEFORE:
-------
date_param = self.request.query_params.get('date', None)
if date_param:
    queryset = queryset.filter(date=date_param)

AFTER:
------
date_param = self.request.query_params.get('date', None)
date_from = self.request.query_params.get('date_from', None)
date_to = self.request.query_params.get('date_to', None)

if date_param:
    queryset = queryset.filter(date=date_param)
elif date_from and date_to:
    queryset = queryset.filter(date__gte=date_from, date__lte=date_to)
elif date_from:
    queryset = queryset.filter(date__gte=date_from)
elif date_to:
    queryset = queryset.filter(date__lte=date_to)

ViewSets to Update:
==================
1. ✅ GroupViewSet - Already updated
2. AttendanceViewSet - date field
3. EventViewSet - time__date field
4. ExamScoreViewSet - date field
5. PaymentViewSet - date field
6. ShopOrderViewSet - created_at__date field
7. StoryViewSet - created_at__date field
8. StudentCoinsViewSet - created_at__date field
9. TicketViewSet - created_at__date field
10. TicketChatViewSet - created_at__date field
11. ExpenseViewSet - date field
12. InformationViewSet - created_at__date field
13. BookingViewSet - booked_at__date field

In users/views.py:
14. StudentViewSet - date_joined__date field
15. TeacherViewSet - date_joined__date field

In task/views.py:
16. TaskViewSet - created_at__date OR due_date__date

In messaging/views.py:
17. SmsHistoryViewSet - sent_at__date field

In crm/views.py:
18. LeadViewSet - created_at__date field

Total: 18 ViewSets
""")

"""
Celery Beat Schedule Configuration
Defines all periodic tasks and their schedules.
"""

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # ============================================
    # FINANCIAL AUTOMATION
    # ============================================

    # Calculate yesterday's financial summary every day at 1 AM
    'calculate-daily-summary': {
        'task': 'calculate_daily_financial_summary',
        'schedule': crontab(hour=1, minute=0),
    },

    # Send payment reminders every Monday at 9 AM
    'send-payment-reminders': {
        'task': 'send_payment_reminders',
        'schedule': crontab(day_of_week=1, hour=9, minute=0),
        'kwargs': {'days_threshold': 7}
    },

    # Auto-mark paid fines every day at 2 AM
    'auto-mark-paid-fines': {
        'task': 'auto_mark_paid_fines',
        'schedule': crontab(hour=2, minute=0),
    },

    # Recalculate all balances every Sunday at 3 AM
    'recalculate-all-balances': {
        'task': 'recalculate_all_student_balances',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
    },

    # ============================================
    # ANOMALY DETECTION
    # ============================================

    # Detect payment anomalies every 6 hours
    'detect-payment-anomalies': {
        'task': 'detect_payment_anomalies',
        'schedule': crontab(hour='*/6', minute=0),
    },

    # Detect attendance anomalies daily at 8 AM
    'detect-attendance-anomalies': {
        'task': 'detect_attendance_anomalies',
        'schedule': crontab(hour=8, minute=0),
    },

    # Detect system anomalies every 30 minutes
    'detect-system-anomalies': {
        'task': 'detect_system_anomalies',
        'schedule': crontab(minute='*/30'),
    },

    # Detect financial anomalies daily at 10 AM
    'detect-financial-anomalies': {
        'task': 'detect_financial_anomalies',
        'schedule': crontab(hour=10, minute=0),
    },

    # ============================================
    # PREDICTIVE ANALYTICS
    # ============================================

    # Predict student churn every Monday at 7 AM
    'predict-student-churn': {
        'task': 'predict_student_churn',
        'schedule': crontab(day_of_week=1, hour=7, minute=0),
    },

    # Predict group performance weekly on Sunday at 8 PM
    'predict-group-performance': {
        'task': 'predict_group_performance',
        'schedule': crontab(day_of_week=0, hour=20, minute=0),
    },

    # Forecast revenue monthly on 1st day at 9 AM
    'predict-revenue-forecast': {
        'task': 'predict_revenue_forecast',
        'schedule': crontab(day_of_month=1, hour=9, minute=0),
    },

    # ============================================
    # SYSTEM MAINTENANCE
    # ============================================

    # Backup database every day at 3 AM
    'backup-database': {
        'task': 'backup_database',
        'schedule': crontab(hour=3, minute=0),
    },

    # Clear expired sessions every day at 4 AM
    'clear-expired-sessions': {
        'task': 'clear_expired_sessions',
        'schedule': crontab(hour=4, minute=0),
    },

    # Optimize database every Sunday at 4 AM
    'optimize-database': {
        'task': 'optimize_database_indexes',
        'schedule': crontab(day_of_week=0, hour=4, minute=0),
    },

    # System health check every 15 minutes
    'system-health-check': {
        'task': 'perform_system_health_check',
        'schedule': crontab(minute='*/15'),
    },

    # ============================================
    # REPORTS & ANALYTICS
    # ============================================

    # Generate daily analytics report at 11 PM
    'daily-analytics-report': {
        'task': 'generate_daily_analytics_report',
        'schedule': crontab(hour=23, minute=0),
    },

    # Generate weekly report every Monday at 10 AM
    'weekly-report': {
        'task': 'generate_weekly_report',
        'schedule': crontab(day_of_week=1, hour=10, minute=0),
    },

    # Generate monthly report on 1st day at 11 AM
    'monthly-report': {
        'task': 'generate_monthly_report',
        'schedule': crontab(day_of_month=1, hour=11, minute=0),
    },

    # ============================================
    # NOTIFICATIONS
    # ============================================

    # Process pending notifications every 5 minutes
    'process-notifications': {
        'task': 'process_pending_notifications',
        'schedule': crontab(minute='*/5'),
    },

    # Send daily digest emails at 8 AM
    'daily-digest-emails': {
        'task': 'send_daily_digest_emails',
        'schedule': crontab(hour=8, minute=30),
    },
}

# Task routing configuration
CELERY_TASK_ROUTES = {
    # High priority tasks
    'detect_system_anomalies': {'queue': 'high_priority'},
    'perform_system_health_check': {'queue': 'high_priority'},

    # Medium priority tasks
    'detect_*': {'queue': 'medium_priority'},
    'predict_*': {'queue': 'medium_priority'},

    # Low priority tasks (reports, backups)
    'generate_*': {'queue': 'low_priority'},
    'backup_*': {'queue': 'low_priority'},
    'calculate_*': {'queue': 'low_priority'},
}

# Task time limits (in seconds)
CELERY_TASK_TIME_LIMIT = {
    'backup_database': 1800,  # 30 minutes
    'recalculate_all_student_balances': 3600,  # 1 hour
    'predict_student_churn': 1800,  # 30 minutes
    'default': 600,  # 10 minutes for other tasks
}

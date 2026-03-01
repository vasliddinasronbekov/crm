"""
Celery configuration for edu_project.

This module sets up Celery for async task processing and scheduled tasks.
"""
import os

try:
    from celery import Celery
    from celery.schedules import crontab
except ImportError:
    # Celery not available - skip celery setup
    Celery = None
    crontab = None

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')

# Create Celery app
if Celery is not None:
    app = Celery('edu_project')
else:
    app = None

# Load config from Django settings using 'CELERY_' namespace
if app is not None:
    app.config_from_object('django.conf:settings', namespace='CELERY')
    
    # Auto-discover tasks from all installed apps
    app.autodiscover_tasks()

# Configure Celery Beat schedule
if app is not None:
    app.conf.beat_schedule = {
    # === FINANCIAL AUTOMATION ===

    # Calculate yesterday's financial summary every day at 1 AM
    'calculate-daily-summary': {
        'task': 'calculate_daily_financial_summary',
        'schedule': crontab(hour=1, minute=0),
        'options': {'queue': 'default'},
    },

    # Send payment reminders every Monday at 9 AM
    'send-payment-reminders': {
        'task': 'send_payment_reminders',
        'schedule': crontab(day_of_week=1, hour=9, minute=0),
        'kwargs': {'days_threshold': 7},
        'options': {'queue': 'default'},
    },

    # Auto-mark paid fines every day at 2 AM
    'auto-mark-paid-fines': {
        'task': 'auto_mark_paid_fines',
        'schedule': crontab(hour=2, minute=0),
        'options': {'queue': 'default'},
    },

    # Recalculate all student balances every Sunday at 3 AM
    'recalculate-all-balances': {
        'task': 'recalculate_all_student_balances',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
        'options': {'queue': 'default'},
    },

    # Calculate weekly summaries every Monday at 4 AM
    'calculate-weekly-summaries': {
        'task': 'calculate_weekly_financial_summaries',
        'schedule': crontab(day_of_week=1, hour=4, minute=0),
        'options': {'queue': 'default'},
    },

    # === DATABASE MAINTENANCE ===

    # Cleanup old transactions every month (1st day at 5 AM)
    'cleanup-old-transactions': {
        'task': 'cleanup_old_transactions',
        'schedule': crontab(day_of_month=1, hour=5, minute=0),
        'kwargs': {'days_to_keep': 365},
        'options': {'queue': 'maintenance'},
    },

    # Database backup every day at 4 AM
    'daily-database-backup': {
        'task': 'backup_database',
        'schedule': crontab(hour=4, minute=0),
        'options': {'queue': 'maintenance'},
    },

    # === ANALYTICS & REPORTING ===

    # Generate daily analytics report at 6 AM
    'generate-daily-analytics': {
        'task': 'generate_daily_analytics_report',
        'schedule': crontab(hour=6, minute=0),
        'options': {'queue': 'reports'},
    },

    # Generate weekly report every Monday at 7 AM
    'generate-weekly-report': {
        'task': 'generate_weekly_report',
        'schedule': crontab(day_of_week=1, hour=7, minute=0),
        'options': {'queue': 'reports'},
    },

    # Generate monthly report on 1st day at 8 AM
    'generate-monthly-report': {
        'task': 'generate_monthly_report',
        'schedule': crontab(day_of_month=1, hour=8, minute=0),
        'options': {'queue': 'reports'},
    },

    # === AI & MACHINE LEARNING ===

    # Retrain AI models every week on Sunday at midnight
    'retrain-ai-models': {
        'task': 'retrain_intent_classifier',
        'schedule': crontab(day_of_week=0, hour=0, minute=0),
        'options': {'queue': 'ml'},
    },

    # Update knowledge base every day at 3 AM
    'update-knowledge-base': {
        'task': 'update_knowledge_base',
        'schedule': crontab(hour=3, minute=0),
        'options': {'queue': 'ml'},
    },

    # === NOTIFICATIONS ===

    # Send daily digest emails at 8 AM
    'send-daily-digest': {
        'task': 'send_daily_digest_emails',
        'schedule': crontab(hour=8, minute=0),
        'options': {'queue': 'notifications'},
    },

    # Process pending notifications every 15 minutes
    'process-pending-notifications': {
        'task': 'process_pending_notifications',
        'schedule': crontab(minute='*/15'),
        'options': {'queue': 'notifications'},
    },

    # === HEALTH CHECKS ===

    # Check system health every hour
    'system-health-check': {
        'task': 'perform_system_health_check',
        'schedule': crontab(minute=0),  # Every hour
        'options': {'queue': 'monitoring'},
    },

    # === CLEANUP & OPTIMIZATION ===

    # Clear expired sessions every day at midnight
    'clear-expired-sessions': {
        'task': 'clear_expired_sessions',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': 'maintenance'},
    },

    # Optimize database indexes weekly on Saturday at 2 AM
    'optimize-database': {
        'task': 'optimize_database_indexes',
        'schedule': crontab(day_of_week=6, hour=2, minute=0),
        'options': {'queue': 'maintenance'},
    },
}

# Task routing configuration
    app.conf.task_routes = {
    'calculate_*': {'queue': 'default'},
    'send_*': {'queue': 'notifications'},
    'generate_*': {'queue': 'reports'},
    'backup_*': {'queue': 'maintenance'},
    'retrain_*': {'queue': 'ml'},
    'update_*': {'queue': 'ml'},
    'process_*': {'queue': 'default'},
    'auto_*': {'queue': 'default'},
    'cleanup_*': {'queue': 'maintenance'},
    'optimize_*': {'queue': 'maintenance'},
}

# Task configuration
    app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Tashkent',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

if app is not None:
    @app.task(bind=True, ignore_result=True)
    def debug_task(self):
        """Debug task for testing Celery setup."""
        print(f'Request: {self.request!r}')

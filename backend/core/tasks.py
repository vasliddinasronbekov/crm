"""
Core system tasks for maintenance, monitoring, and automation.
"""
from celery import shared_task
from django.core.management import call_command
from django.conf import settings
from django.utils import timezone
from django.db import connection
import subprocess
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


@shared_task(name='backup_database')
def backup_database():
    """
    Create automated database backup.
    Supports both PostgreSQL and SQLite databases.

    Returns:
        dict: Backup status and file paths
    """
    try:
        backup_dir = Path(settings.BASE_DIR) / 'backups' / 'database'
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backups_created = []

        # Backup main database
        db_config = settings.DATABASES['default']

        if 'postgresql' in db_config.get('ENGINE', ''):
            # PostgreSQL backup
            backup_file = backup_dir / f'main_db_{timestamp}.sql.gz'

            # Extract connection details
            db_name = db_config.get('NAME')
            db_user = db_config.get('USER')
            db_host = db_config.get('HOST', 'localhost')
            db_port = db_config.get('PORT', '5432')
            db_password = db_config.get('PASSWORD', '')

            # Set password environment variable
            env = os.environ.copy()
            env['PGPASSWORD'] = db_password

            # Run pg_dump with gzip compression
            cmd = f'pg_dump -h {db_host} -p {db_port} -U {db_user} -d {db_name} | gzip > {backup_file}'
            result = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)

            if result.returncode == 0:
                backups_created.append({
                    'database': 'main',
                    'file': str(backup_file),
                    'size_mb': round(backup_file.stat().st_size / (1024 * 1024), 2)
                })
            else:
                logger.error(f"PostgreSQL backup failed: {result.stderr}")

        elif 'sqlite' in db_config.get('ENGINE', ''):
            # SQLite backup (simple file copy)
            db_path = Path(db_config.get('NAME'))
            if db_path.exists():
                backup_file = backup_dir / f'main_db_{timestamp}.sqlite3'
                subprocess.run(['cp', str(db_path), str(backup_file)], check=True)
                backups_created.append({
                    'database': 'main',
                    'file': str(backup_file),
                    'size_mb': round(backup_file.stat().st_size / (1024 * 1024), 2)
                })

        # Backup analytics database (SQLite)
        if 'analytics' in settings.DATABASES:
            analytics_config = settings.DATABASES['analytics']
            analytics_path = Path(analytics_config.get('NAME'))
            if analytics_path.exists():
                backup_file = backup_dir / f'analytics_db_{timestamp}.sqlite3'
                subprocess.run(['cp', str(analytics_path), str(backup_file)], check=True)
                backups_created.append({
                    'database': 'analytics',
                    'file': str(backup_file),
                    'size_mb': round(backup_file.stat().st_size / (1024 * 1024), 2)
                })

        # Cleanup old backups (keep last 30 days)
        cutoff_date = datetime.now() - timedelta(days=30)
        for old_backup in backup_dir.glob('*'):
            if old_backup.is_file():
                file_time = datetime.fromtimestamp(old_backup.stat().st_mtime)
                if file_time < cutoff_date:
                    old_backup.unlink()
                    logger.info(f"Deleted old backup: {old_backup}")

        return {
            'success': True,
            'timestamp': timestamp,
            'backups': backups_created,
            'backup_dir': str(backup_dir)
        }

    except Exception as e:
        logger.exception("Database backup failed")
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='clear_expired_sessions')
def clear_expired_sessions():
    """Clear expired Django sessions."""
    try:
        call_command('clearsessions')
        return {'success': True, 'message': 'Expired sessions cleared'}
    except Exception as e:
        logger.exception("Failed to clear expired sessions")
        return {'success': False, 'error': str(e)}


@shared_task(name='optimize_database_indexes')
def optimize_database_indexes():
    """
    Optimize database indexes and vacuum (PostgreSQL).
    Improves query performance.
    """
    try:
        db_engine = settings.DATABASES['default']['ENGINE']

        if 'postgresql' in db_engine:
            with connection.cursor() as cursor:
                # Analyze all tables to update statistics
                cursor.execute("ANALYZE;")

                # Vacuum to reclaim space (non-blocking)
                cursor.execute("VACUUM ANALYZE;")

            return {'success': True, 'message': 'Database optimized (PostgreSQL)'}

        elif 'sqlite' in db_engine:
            with connection.cursor() as cursor:
                cursor.execute("VACUUM;")
                cursor.execute("ANALYZE;")

            return {'success': True, 'message': 'Database optimized (SQLite)'}

        return {'success': True, 'message': 'No optimization needed for this database engine'}

    except Exception as e:
        logger.exception("Database optimization failed")
        return {'success': False, 'error': str(e)}


@shared_task(name='perform_system_health_check')
def perform_system_health_check():
    """
    Perform comprehensive system health check.
    Checks database, Redis, disk space, and services.
    """
    health_status = {
        'timestamp': timezone.now().isoformat(),
        'checks': {}
    }

    # Check database connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['checks']['database'] = {'status': 'healthy'}
    except Exception as e:
        health_status['checks']['database'] = {'status': 'unhealthy', 'error': str(e)}
        logger.error(f"Database health check failed: {e}")

    # Check Redis connection
    try:
        from django.core.cache import cache
        cache.set('health_check', 'ok', 60)
        result = cache.get('health_check')
        if result == 'ok':
            health_status['checks']['redis'] = {'status': 'healthy'}
        else:
            health_status['checks']['redis'] = {'status': 'unhealthy', 'error': 'Cache read failed'}
    except Exception as e:
        health_status['checks']['redis'] = {'status': 'unhealthy', 'error': str(e)}
        logger.error(f"Redis health check failed: {e}")

    # Check disk space
    try:
        stat = os.statvfs(settings.BASE_DIR)
        free_space_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
        total_space_gb = (stat.f_blocks * stat.f_frsize) / (1024**3)
        usage_percent = ((total_space_gb - free_space_gb) / total_space_gb) * 100

        health_status['checks']['disk_space'] = {
            'status': 'healthy' if usage_percent < 90 else 'warning',
            'free_gb': round(free_space_gb, 2),
            'total_gb': round(total_space_gb, 2),
            'usage_percent': round(usage_percent, 2)
        }

        if usage_percent > 90:
            logger.warning(f"Disk space usage is high: {usage_percent:.1f}%")

    except Exception as e:
        health_status['checks']['disk_space'] = {'status': 'unknown', 'error': str(e)}

    # Overall status
    all_healthy = all(
        check.get('status') == 'healthy'
        for check in health_status['checks'].values()
    )
    health_status['overall_status'] = 'healthy' if all_healthy else 'degraded'

    # Log if unhealthy
    if not all_healthy:
        logger.warning(f"System health check detected issues: {health_status}")

    return health_status


@shared_task(name='generate_daily_analytics_report')
def generate_daily_analytics_report():
    """Generate daily analytics summary."""
    try:
        from analytics.models import AnalyticsEvent
        from users.models import User
        from student_profile.models import Group

        yesterday = timezone.now().date() - timedelta(days=1)

        report = {
            'date': str(yesterday),
            'metrics': {}
        }

        # Active users
        active_users = User.objects.filter(
            last_login__date=yesterday
        ).count()
        report['metrics']['active_users'] = active_users

        # New enrollments
        new_enrollments = Group.objects.filter(
            created_at__date=yesterday
        ).count()
        report['metrics']['new_enrollments'] = new_enrollments

        # Analytics events
        if AnalyticsEvent._meta.db_table in connection.introspection.table_names():
            total_events = AnalyticsEvent.objects.filter(
                created_at__date=yesterday
            ).count()
            report['metrics']['total_events'] = total_events

        logger.info(f"Daily analytics report generated: {report}")
        return {'success': True, 'report': report}

    except Exception as e:
        logger.exception("Failed to generate daily analytics report")
        return {'success': False, 'error': str(e)}


@shared_task(name='generate_weekly_report')
def generate_weekly_report():
    """Generate weekly summary report."""
    try:
        week_ago = timezone.now() - timedelta(days=7)

        from users.models import User
        from student_profile.models import Payment

        report = {
            'period': 'weekly',
            'start_date': str(week_ago.date()),
            'end_date': str(timezone.now().date()),
            'metrics': {}
        }

        # New users
        new_users = User.objects.filter(
            date_joined__gte=week_ago
        ).count()
        report['metrics']['new_users'] = new_users

        # Total payments
        total_payments = Payment.objects.filter(
            created_at__gte=week_ago,
            status='paid'
        ).count()
        report['metrics']['total_payments'] = total_payments

        logger.info(f"Weekly report generated: {report}")
        return {'success': True, 'report': report}

    except Exception as e:
        logger.exception("Failed to generate weekly report")
        return {'success': False, 'error': str(e)}


@shared_task(name='generate_monthly_report')
def generate_monthly_report():
    """Generate monthly summary report."""
    try:
        month_ago = timezone.now() - timedelta(days=30)

        report = {
            'period': 'monthly',
            'start_date': str(month_ago.date()),
            'end_date': str(timezone.now().date()),
            'metrics': {}
        }

        # TODO: Add comprehensive monthly metrics

        logger.info(f"Monthly report generated: {report}")
        return {'success': True, 'report': report}

    except Exception as e:
        logger.exception("Failed to generate monthly report")
        return {'success': False, 'error': str(e)}


@shared_task(name='send_daily_digest_emails')
def send_daily_digest_emails():
    """Send daily digest emails to admins and managers."""
    try:
        # TODO: Implement email sending logic
        # This would send summary emails to admins

        logger.info("Daily digest emails sent")
        return {'success': True, 'emails_sent': 0}

    except Exception as e:
        logger.exception("Failed to send daily digest emails")
        return {'success': False, 'error': str(e)}


@shared_task(name='process_pending_notifications')
def process_pending_notifications():
    """Process any pending notifications in the queue."""
    try:
        # TODO: Implement notification processing logic
        # This would process pending push notifications, SMS, etc.

        return {'success': True, 'notifications_processed': 0}

    except Exception as e:
        logger.exception("Failed to process pending notifications")
        return {'success': False, 'error': str(e)}

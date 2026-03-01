"""
Monitoring and alerting automation.
Integrates with Sentry, Prometheus, and custom health checks.
"""
import logging
import os
from django.conf import settings

logger = logging.getLogger(__name__)


def setup_sentry():
    """
    Initialize Sentry for error tracking and monitoring.
    """
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.redis import RedisIntegration

        sentry_dsn = os.environ.get('SENTRY_DSN')

        if sentry_dsn and not settings.DEBUG:
            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[
                    DjangoIntegration(),
                    CeleryIntegration(),
                    RedisIntegration(),
                ],
                traces_sample_rate=0.1,  # 10% of transactions
                send_default_pii=False,  # Don't send PII data
                environment=os.environ.get('ENVIRONMENT', 'production'),
                release=os.environ.get('GIT_COMMIT', 'unknown'),

                # Performance monitoring
                profiles_sample_rate=0.1,

                # Error filtering
                before_send=filter_errors,
            )

            logger.info("Sentry monitoring initialized")
        else:
            logger.info("Sentry monitoring disabled (DEBUG mode or no DSN)")

    except ImportError:
        logger.warning("Sentry SDK not installed. Install with: pip install sentry-sdk")


def filter_errors(event, hint):
    """
    Filter out errors that shouldn't be reported to Sentry.
    """
    # Don't report 404 errors
    if event.get('logger') == 'django.request':
        if 'status_code' in event.get('extra', {}):
            if event['extra']['status_code'] == 404:
                return None

    # Don't report known bot errors
    if 'request' in event:
        user_agent = event['request'].get('headers', {}).get('User-Agent', '')
        if any(bot in user_agent.lower() for bot in ['bot', 'crawler', 'spider']):
            return None

    return event


class PerformanceMonitor:
    """
    Monitor application performance metrics.
    """

    @staticmethod
    def track_db_query_time(query_time):
        """Track database query performance."""
        if query_time > 1.0:  # Slow query threshold: 1 second
            logger.warning(f"Slow database query detected: {query_time:.2f}s")

    @staticmethod
    def track_api_response_time(endpoint, response_time):
        """Track API endpoint performance."""
        if response_time > 2.0:  # Slow API threshold: 2 seconds
            logger.warning(f"Slow API endpoint {endpoint}: {response_time:.2f}s")

    @staticmethod
    def track_cache_hit_rate(hits, misses):
        """Track cache performance."""
        total = hits + misses
        if total > 0:
            hit_rate = (hits / total) * 100
            if hit_rate < 70:  # Low hit rate threshold
                logger.warning(f"Low cache hit rate: {hit_rate:.1f}%")


class AlertManager:
    """
    Manage alerts and notifications for critical issues.
    """

    @staticmethod
    def send_alert(severity, title, message, details=None):
        """
        Send alert via multiple channels (email, Slack, etc.).

        Args:
            severity: 'critical', 'error', 'warning', 'info'
            title: Alert title
            message: Alert message
            details: Additional details (dict)
        """
        details = details or {}

        # Log the alert
        log_message = f"[{severity.upper()}] {title}: {message}"
        if severity == 'critical':
            logger.critical(log_message)
        elif severity == 'error':
            logger.error(log_message)
        elif severity == 'warning':
            logger.warning(log_message)
        else:
            logger.info(log_message)

        # Send to Sentry if critical or error
        if severity in ['critical', 'error']:
            try:
                import sentry_sdk
                with sentry_sdk.push_scope() as scope:
                    scope.set_level(severity)
                    scope.set_context("alert_details", details)
                    sentry_sdk.capture_message(f"{title}: {message}")
            except ImportError:
                pass

        # Send to Slack if configured
        slack_webhook = os.environ.get('SLACK_WEBHOOK_URL')
        if slack_webhook:
            try:
                import requests
                import json

                emoji = {
                    'critical': ':rotating_light:',
                    'error': ':x:',
                    'warning': ':warning:',
                    'info': ':information_source:'
                }.get(severity, ':bell:')

                payload = {
                    'text': f"{emoji} *{title}*",
                    'attachments': [{
                        'color': {
                            'critical': 'danger',
                            'error': 'danger',
                            'warning': 'warning',
                            'info': 'good'
                        }.get(severity, '#808080'),
                        'fields': [
                            {'title': 'Severity', 'value': severity.upper(), 'short': True},
                            {'title': 'Environment', 'value': os.environ.get('ENVIRONMENT', 'unknown'), 'short': True},
                            {'title': 'Message', 'value': message, 'short': False},
                        ]
                    }]
                }

                if details:
                    payload['attachments'][0]['fields'].append({
                        'title': 'Details',
                        'value': json.dumps(details, indent=2),
                        'short': False
                    })

                requests.post(slack_webhook, json=payload, timeout=5)

            except Exception as e:
                logger.error(f"Failed to send Slack alert: {e}")

        # Send email for critical alerts
        if severity == 'critical':
            try:
                from django.core.mail import mail_admins
                mail_admins(
                    subject=f"[CRITICAL] {title}",
                    message=f"{message}\n\nDetails: {details}",
                    fail_silently=True
                )
            except Exception as e:
                logger.error(f"Failed to send email alert: {e}")


# Initialize Sentry on module import (if not in DEBUG mode)
if not settings.DEBUG:
    setup_sentry()

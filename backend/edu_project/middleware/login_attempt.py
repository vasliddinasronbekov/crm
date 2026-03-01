"""
Login Attempt Tracking Middleware
Prevents brute force attacks by locking accounts after failed attempts
"""

from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class LoginAttemptMiddleware:
    """
    Tracks login attempts and locks accounts/IPs after too many failures
    """

    MAX_ATTEMPTS = getattr(settings, 'MAX_LOGIN_ATTEMPTS', 5)
    LOCKOUT_DURATION = getattr(settings, 'LOGIN_LOCKOUT_DURATION', 900)  # 15 minutes

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response


def record_login_attempt(username, ip_address, success=False):
    """Record a login attempt"""
    cache_key_user = f'login_attempts:user:{username}'
    cache_key_ip = f'login_attempts:ip:{ip_address}'

    if success:
        # Clear failed attempts on successful login
        cache.delete(cache_key_user)
        cache.delete(cache_key_ip)
        logger.info(f"Successful login for user: {username} from IP: {ip_address}")
    else:
        # Increment failed attempts
        user_attempts = cache.get(cache_key_user, 0) + 1
        ip_attempts = cache.get(cache_key_ip, 0) + 1

        lockout_duration = LoginAttemptMiddleware.LOCKOUT_DURATION
        cache.set(cache_key_user, user_attempts, lockout_duration)
        cache.set(cache_key_ip, ip_attempts, lockout_duration)

        logger.warning(
            f"Failed login attempt #{user_attempts} for user: {username} from IP: {ip_address}"
        )


def is_locked_out(username, ip_address):
    """Check if user or IP is locked out"""
    max_attempts = LoginAttemptMiddleware.MAX_ATTEMPTS

    cache_key_user = f'login_attempts:user:{username}'
    cache_key_ip = f'login_attempts:ip:{ip_address}'

    user_attempts = cache.get(cache_key_user, 0)
    ip_attempts = cache.get(cache_key_ip, 0)

    if user_attempts >= max_attempts:
        remaining_time = cache.ttl(cache_key_user)
        logger.warning(f"User {username} is locked out. Remaining: {remaining_time}s")
        return True, f"Account locked due to too many failed attempts. Try again in {remaining_time // 60} minutes."

    if ip_attempts >= max_attempts:
        remaining_time = cache.ttl(cache_key_ip)
        logger.warning(f"IP {ip_address} is locked out. Remaining: {remaining_time}s")
        return True, f"Too many login attempts from this location. Try again in {remaining_time // 60} minutes."

    return False, None


def get_remaining_attempts(username, ip_address):
    """Get number of remaining login attempts"""
    max_attempts = LoginAttemptMiddleware.MAX_ATTEMPTS

    cache_key_user = f'login_attempts:user:{username}'
    cache_key_ip = f'login_attempts:ip:{ip_address}'

    user_attempts = cache.get(cache_key_user, 0)
    ip_attempts = cache.get(cache_key_ip, 0)

    return max_attempts - max(user_attempts, ip_attempts)

"""
Custom middleware for EduVoice Platform
Includes rate limiting, request logging, and security enhancements
"""

import time
import logging
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from functools import wraps

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    """
    Rate limiting middleware to prevent API abuse
    Uses Redis cache for distributed rate limiting
    """

    def __init__(self, get_response):
        self.get_response = get_response

        # Rate limit settings (requests per minute)
        self.rate_limits = {
            'default': 60,  # 60 requests per minute
            'auth': 5,      # 5 login attempts per minute
            'api': 100,     # 100 API requests per minute for authenticated users
        }

    def __call__(self, request):
        # Skip rate limiting for superusers and health checks
        if request.user.is_superuser or request.path in ['/api/health/', '/api/alive/', '/api/ready/']:
            return self.get_response(request)

        # Determine rate limit type
        rate_limit_type = 'default'
        if '/auth/' in request.path or '/login/' in request.path:
            rate_limit_type = 'auth'
        elif request.user.is_authenticated:
            rate_limit_type = 'api'

        # Check rate limit
        if not self.check_rate_limit(request, rate_limit_type):
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'detail': f'Maximum {self.rate_limits[rate_limit_type]} requests per minute allowed'
            }, status=429)

        response = self.get_response(request)
        return response

    def check_rate_limit(self, request, limit_type):
        """
        Check if request is within rate limit
        Returns True if allowed, False if rate limit exceeded
        """
        # Get client identifier (IP address or user ID)
        client_id = self.get_client_identifier(request)
        cache_key = f'rate_limit:{limit_type}:{client_id}'

        # Get current count from cache
        current_count = cache.get(cache_key, 0)

        if current_count >= self.rate_limits[limit_type]:
            logger.warning(f'Rate limit exceeded for {client_id} on {request.path}')
            return False

        # Increment counter with 60 second expiry
        cache.set(cache_key, current_count + 1, 60)
        return True

    def get_client_identifier(self, request):
        """Get unique client identifier (IP or user ID)"""
        if request.user.is_authenticated:
            return f'user_{request.user.id}'

        # Get IP address (handle proxy forwarding)
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')

        return f'ip_{ip}'


class RequestLoggingMiddleware:
    """
    Log all API requests for monitoring and debugging
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Record start time
        start_time = time.time()

        # Get response
        response = self.get_response(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log request (skip static files)
        if not request.path.startswith('/static/') and not request.path.startswith('/media/'):
            log_data = {
                'method': request.method,
                'path': request.path,
                'status': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'user': request.user.username if request.user.is_authenticated else 'anonymous',
                'ip': self.get_client_ip(request),
            }

            # Log level based on status code
            if response.status_code >= 500:
                logger.error(f'Request: {log_data}')
            elif response.status_code >= 400:
                logger.warning(f'Request: {log_data}')
            else:
                logger.info(f'Request: {log_data}')

        # Add performance headers (for debugging)
        if settings.DEBUG:
            response['X-Response-Time'] = f'{duration * 1000:.2f}ms'

        return response

    def get_client_ip(self, request):
        """Get real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class SecurityHeadersMiddleware:
    """
    Add security headers to all responses
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Add security headers
        if not settings.DEBUG:
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'DENY'
            response['X-XSS-Protection'] = '1; mode=block'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

            # Content Security Policy (adjust as needed)
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self';"
            )

            # Permissions Policy (formerly Feature-Policy)
            response['Permissions-Policy'] = (
                "geolocation=(), "
                "microphone=(), "
                "camera=()"
            )

        return response


class APIThrottlingMiddleware:
    """
    More granular API throttling for specific endpoints
    """

    def __init__(self, get_response):
        self.get_response = get_response

        # Endpoint-specific throttle rates (requests per hour)
        self.throttle_rates = {
            '/api/v1/ai/stt/': 100,        # STT: 100/hour
            '/api/v1/ai/tts/': 200,        # TTS: 200/hour
            '/api/v1/ai/intent/': 300,     # Intent: 300/hour
            '/api/v1/send-message/': 50,   # SMS: 50/hour
            '/api/v1/payment/create/': 20, # Payments: 20/hour
        }

    def __call__(self, request):
        # Check endpoint-specific throttling
        for endpoint, limit in self.throttle_rates.items():
            if request.path.startswith(endpoint):
                if not self.check_throttle(request, endpoint, limit):
                    return JsonResponse({
                        'error': 'Throttle limit exceeded',
                        'detail': f'Maximum {limit} requests per hour allowed for this endpoint'
                    }, status=429)

        response = self.get_response(request)
        return response

    def check_throttle(self, request, endpoint, limit):
        """Check endpoint-specific throttle"""
        client_id = self.get_client_id(request)
        cache_key = f'throttle:{endpoint}:{client_id}'

        current_count = cache.get(cache_key, 0)

        if current_count >= limit:
            logger.warning(f'Throttle exceeded for {client_id} on {endpoint}')
            return False

        # Increment with 1 hour expiry
        cache.set(cache_key, current_count + 1, 3600)
        return True

    def get_client_id(self, request):
        """Get client identifier"""
        if request.user.is_authenticated:
            return f'user_{request.user.id}'

        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')

        return f'ip_{ip}'


# Decorator for function-based views
def rate_limit(requests_per_minute=60):
    """
    Decorator to add rate limiting to function-based views

    Usage:
        @rate_limit(requests_per_minute=30)
        def my_view(request):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            client_id = get_client_identifier(request)
            cache_key = f'rate_limit:view:{func.__name__}:{client_id}'

            current_count = cache.get(cache_key, 0)

            if current_count >= requests_per_minute:
                return JsonResponse({
                    'error': 'Rate limit exceeded',
                    'detail': f'Maximum {requests_per_minute} requests per minute'
                }, status=429)

            cache.set(cache_key, current_count + 1, 60)
            return func(request, *args, **kwargs)

        return wrapper
    return decorator


def get_client_identifier(request):
    """Helper function to get client identifier"""
    if request.user.is_authenticated:
        return f'user_{request.user.id}'

    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')

    return f'ip_{ip}'

"""
Rate Limiting Middleware for Django
Prevents brute force attacks and API abuse
"""

from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from functools import wraps
import time


class RateLimitMiddleware:
    """
    Global rate limiting middleware
    Can be bypassed for specific views using @exempt_from_rate_limit decorator
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = getattr(settings, 'ENABLE_RATE_LIMITING', True)

    def __call__(self, request):
        # Skip rate limiting if disabled or if view is exempted
        if not self.enabled or getattr(request, '_exempt_from_rate_limit', False):
            return self.get_response(request)

        # Get client identifier (IP address)
        client_ip = self.get_client_ip(request)

        # Check rate limit
        if self.is_rate_limited(client_ip, request.path):
            return JsonResponse({
                'error': 'Rate limit exceeded. Please try again later.',
                'retry_after': 60  # seconds
            }, status=429)

        response = self.get_response(request)
        return response

    def get_client_ip(self, request):
        """Get real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def is_rate_limited(self, client_ip, path):
        """Check if client has exceeded rate limit"""
        # Define different rate limits for different endpoints
        limits = {
            '/api/v1/student-profile/login/': (5, 300),  # 5 attempts per 5 minutes
            '/api/auth/login/': (5, 300),
            'default': (100, 3600),  # 100 requests per hour for other endpoints
        }

        # Get appropriate limit
        max_requests, window = limits.get(path, limits['default'])

        # Cache key for this client and path
        cache_key = f'rate_limit:{client_ip}:{path}'

        # Get current count
        current = cache.get(cache_key, 0)

        if current >= max_requests:
            return True

        # Increment count
        cache.set(cache_key, current + 1, window)
        return False


def exempt_from_rate_limit(view_func):
    """Decorator to exempt a view from rate limiting"""
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        request._exempt_from_rate_limit = True
        return view_func(request, *args, **kwargs)
    return wrapped_view


def rate_limit(max_requests=5, window=300):
    """
    Decorator for view-specific rate limiting

    Usage:
        @rate_limit(max_requests=10, window=60)  # 10 requests per minute
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            # Get client IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                client_ip = x_forwarded_for.split(',')[0]
            else:
                client_ip = request.META.get('REMOTE_ADDR')

            # Cache key
            cache_key = f'rate_limit:{client_ip}:{view_func.__name__}'

            # Get current count
            current = cache.get(cache_key, 0)

            if current >= max_requests:
                return JsonResponse({
                    'error': 'Too many requests. Please try again later.',
                    'retry_after': window
                }, status=429)

            # Increment count
            cache.set(cache_key, current + 1, window)

            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator

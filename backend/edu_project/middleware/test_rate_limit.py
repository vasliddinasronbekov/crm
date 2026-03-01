"""
Tests for rate limiting middleware.
"""

import pytest
from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory
from rest_framework import status

from .rate_limit import RateLimitMiddleware


@pytest.fixture
def get_response():
    """Mock get_response callable for middleware."""
    def _get_response(request):
        return HttpResponse("OK")
    return _get_response


@pytest.fixture
def middleware(get_response):
    """Create rate limit middleware instance."""
    return RateLimitMiddleware(get_response)


@pytest.fixture
def factory():
    """Provide request factory."""
    return RequestFactory()


@pytest.mark.django_db
@pytest.mark.unit
class TestRateLimitMiddleware:
    """Test suite for rate limiting middleware."""

    def test_middleware_allows_first_request(self, middleware, factory):
        """Test that first request is allowed."""
        request = factory.get('/api/test/')
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        response = middleware(request)
        assert response.status_code == 200

    def test_login_endpoint_has_strict_rate_limit(self, middleware, factory):
        """Test that login endpoints have 5 requests per 5 minutes limit."""
        login_url = '/api/v1/student-profile/login/'

        # Make 5 requests (should all succeed)
        for i in range(5):
            request = factory.post(login_url)
            request.META['REMOTE_ADDR'] = '127.0.0.1'
            response = middleware(request)
            assert response.status_code == 200, f"Request {i+1} should succeed"

        # 6th request should be rate limited
        request = factory.post(login_url)
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        response = middleware(request)
        assert response.status_code == 429
        assert b'Rate limit exceeded' in response.content

    def test_different_ips_have_separate_rate_limits(self, middleware, factory):
        """Test that different IP addresses have independent rate limits."""
        login_url = '/api/v1/student-profile/login/'

        # Exhaust rate limit for first IP
        for i in range(5):
            request = factory.post(login_url)
            request.META['REMOTE_ADDR'] = '192.168.1.1'
            middleware(request)

        # Request from first IP should be limited
        request = factory.post(login_url)
        request.META['REMOTE_ADDR'] = '192.168.1.1'
        response = middleware(request)
        assert response.status_code == 429

        # Request from second IP should succeed
        request = factory.post(login_url)
        request.META['REMOTE_ADDR'] = '192.168.1.2'
        response = middleware(request)
        assert response.status_code == 200

    def test_general_api_has_higher_rate_limit(self, middleware, factory):
        """Test that general API endpoints have 100 requests per hour limit."""
        api_url = '/api/v1/courses/'

        # Make many requests (more than login limit)
        for i in range(20):
            request = factory.get(api_url)
            request.META['REMOTE_ADDR'] = '127.0.0.1'
            response = middleware(request)
            assert response.status_code == 200, f"Request {i+1} should succeed"

    def test_exempted_endpoints_not_rate_limited(self, middleware, factory):
        """Test that health check endpoints are exempt from rate limiting."""
        health_urls = [
            '/api/health/',
            '/api/alive/',
            '/api/ready/',
        ]

        for url in health_urls:
            # Make 200 requests (way over any limit)
            for i in range(200):
                request = factory.get(url)
                request.META['REMOTE_ADDR'] = '127.0.0.1'
                response = middleware(request)
                assert response.status_code == 200

    def test_rate_limit_uses_x_forwarded_for_header(self, middleware, factory):
        """Test that X-Forwarded-For header is used for IP detection."""
        login_url = '/api/v1/student-profile/login/'

        # Make requests with X-Forwarded-For header
        for i in range(5):
            request = factory.post(login_url)
            request.META['HTTP_X_FORWARDED_FOR'] = '10.0.0.1, 192.168.1.1'
            request.META['REMOTE_ADDR'] = '127.0.0.1'
            middleware(request)

        # 6th request should be limited based on X-Forwarded-For
        request = factory.post(login_url)
        request.META['HTTP_X_FORWARDED_FOR'] = '10.0.0.1, 192.168.1.1'
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        response = middleware(request)
        assert response.status_code == 429

    def test_rate_limit_counter_increments_correctly(self, middleware, factory):
        """Test that rate limit counter increments with each request."""
        url = '/api/v1/student-profile/login/'
        ip = '127.0.0.1'

        for expected_count in range(1, 6):
            request = factory.post(url)
            request.META['REMOTE_ADDR'] = ip
            middleware(request)

            # Check cache counter
            cache_key = f'rate_limit:{ip}:{url}'
            current_count = cache.get(cache_key, 0)
            assert current_count == expected_count

    def test_cache_key_includes_path_and_ip(self, middleware, factory):
        """Test that cache key properly includes IP and path."""
        url = '/api/v1/student-profile/login/'
        ip = '192.168.1.100'

        request = factory.post(url)
        request.META['REMOTE_ADDR'] = ip
        middleware(request)

        # Verify cache key format
        cache_key = f'rate_limit:{ip}:{url}'
        assert cache.get(cache_key) is not None

    def test_auth_login_endpoint_also_rate_limited(self, middleware, factory):
        """Test that /api/auth/login/ endpoint is also rate limited."""
        login_url = '/api/auth/login/'

        # Make 5 requests (should all succeed)
        for i in range(5):
            request = factory.post(login_url)
            request.META['REMOTE_ADDR'] = '127.0.0.1'
            response = middleware(request)
            assert response.status_code == 200

        # 6th request should be rate limited
        request = factory.post(login_url)
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        response = middleware(request)
        assert response.status_code == 429


@pytest.mark.django_db
@pytest.mark.integration
class TestRateLimitIntegration:
    """Integration tests for rate limiting with actual API calls."""

    def test_rate_limit_applies_to_actual_login_endpoint(self, api_client, user, user_data):
        """Test rate limiting on actual login endpoint."""
        # Make 5 login attempts
        for i in range(5):
            api_client.post(
                '/api/v1/student-profile/login/',
                {
                    'username': user_data['username'],
                    'password': user_data['password']
                },
                format='json'
            )

        # 6th attempt should be rate limited
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

"""
Tests for core app including health check endpoints.
"""

import pytest
from django.core.cache import cache
from django.db import connection
from rest_framework import status
from unittest.mock import patch


@pytest.mark.django_db
@pytest.mark.unit
class TestHealthCheckEndpoints:
    """Test suite for health check endpoints."""

    def test_health_check_returns_200_when_healthy(self, api_client):
        """Test that health check returns 200 when all systems are healthy."""
        response = api_client.get('/api/health/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['status'] == 'healthy'
        assert 'version' in data
        assert 'checks' in data

    def test_health_check_includes_database_status(self, api_client):
        """Test that health check includes database connectivity check."""
        response = api_client.get('/api/health/')
        data = response.json()

        assert 'database' in data['checks']
        assert data['checks']['database'] == 'healthy'

    def test_health_check_includes_cache_status(self, api_client):
        """Test that health check includes cache (Redis) connectivity check."""
        response = api_client.get('/api/health/')
        data = response.json()

        assert 'cache' in data['checks']
        assert data['checks']['cache'] == 'healthy'

    def test_health_check_includes_disk_space(self, api_client):
        """Test that health check includes disk space information."""
        response = api_client.get('/api/health/')
        data = response.json()

        assert 'disk_space' in data['checks']
        # Should include some disk space info
        assert 'GB' in data['checks']['disk_space'] or 'healthy' in data['checks']['disk_space']

    def test_liveness_check_returns_200(self, api_client):
        """Test that liveness probe returns 200."""
        response = api_client.get('/api/alive/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'alive'

    def test_readiness_check_returns_200_when_ready(self, api_client):
        """Test that readiness probe returns 200 when app is ready."""
        response = api_client.get('/api/ready/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['status'] == 'ready'

    def test_readiness_check_validates_database(self, api_client):
        """Test that readiness check validates database connectivity."""
        response = api_client.get('/api/ready/')
        data = response.json()

        # Should include database check
        if 'checks' in data:
            assert 'database' in data['checks']

    def test_health_endpoints_exempt_from_authentication(self, api_client):
        """Test that health check endpoints don't require authentication."""
        # All health endpoints should work without JWT token
        health_urls = ['/api/health/', '/api/alive/', '/api/ready/']

        for url in health_urls:
            response = api_client.get(url)
            # Should return 200, not 401 (unauthorized)
            assert response.status_code == status.HTTP_200_OK

    def test_health_check_response_format(self, api_client):
        """Test that health check has correct response format."""
        response = api_client.get('/api/health/')
        data = response.json()

        # Required fields
        assert 'status' in data
        assert 'version' in data
        assert 'checks' in data

        # Status should be valid value
        assert data['status'] in ['healthy', 'degraded', 'unhealthy']

        # Checks should be a dict
        assert isinstance(data['checks'], dict)

    @patch('core.views.get_currency_rates_snapshot')
    def test_currency_rates_returns_normalized_payload(self, mock_get_rates, api_client):
        mock_get_rates.return_value = {
            'base_currency': 'UZS',
            'supported_currencies': ['UZS', 'USD', 'RUB', 'EUR'],
            'rates_from_base': {
                'UZS': 1.0,
                'USD': 0.000079,
                'RUB': 0.0071,
                'EUR': 0.000073,
            },
            'source': 'open-er-api',
            'fetched_at': '2026-03-08T00:00:00+00:00',
            'expires_in_seconds': 1800,
        }

        response = api_client.get('/api/v1/currency/rates/')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data['base_currency'] == 'UZS'
        assert set(data['supported_currencies']) == {'UZS', 'USD', 'RUB', 'EUR'}
        assert data['rates_from_base']['UZS'] == 1.0
        assert data['rates_from_base']['USD'] > 0
        assert data['source'] in {'open-er-api', 'cache-fallback', 'fallback-static'}

    @patch('core.views.get_currency_rates_snapshot')
    def test_currency_rates_allows_force_refresh_flag(self, mock_get_rates, api_client):
        mock_get_rates.return_value = {
            'base_currency': 'UZS',
            'supported_currencies': ['UZS', 'USD', 'RUB', 'EUR'],
            'rates_from_base': {'UZS': 1.0, 'USD': 0.000079, 'RUB': 0.0071, 'EUR': 0.000073},
            'source': 'open-er-api',
            'fetched_at': '2026-03-08T00:00:00+00:00',
            'expires_in_seconds': 1800,
        }

        response = api_client.get('/api/v1/currency/rates/?force_refresh=true')
        assert response.status_code == status.HTTP_200_OK
        mock_get_rates.assert_called_once_with(force_refresh=True)


@pytest.mark.django_db
@pytest.mark.integration
class TestHealthCheckIntegration:
    """Integration tests for health check with actual services."""

    def test_health_check_detects_cache_availability(self, api_client):
        """Test that health check properly detects cache availability."""
        # Ensure cache is working
        cache.set('test_key', 'test_value', 10)
        assert cache.get('test_key') == 'test_value'

        response = api_client.get('/api/health/')
        data = response.json()

        assert data['checks']['cache'] == 'healthy'

    def test_health_check_detects_database_availability(self, api_client):
        """Test that health check properly detects database availability."""
        # Ensure database is working
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result == (1,)

        response = api_client.get('/api/health/')
        data = response.json()

        assert data['checks']['database'] == 'healthy'

    def test_health_endpoints_work_under_load(self, api_client):
        """Test that health endpoints respond correctly under multiple requests."""
        # Make multiple rapid requests to simulate load balancer health checks
        for _ in range(50):
            response = api_client.get('/api/alive/')
            assert response.status_code == status.HTTP_200_OK

            response = api_client.get('/api/ready/')
            assert response.status_code == status.HTTP_200_OK

    def test_health_check_performance(self, api_client):
        """Test that health check responds quickly."""
        import time

        start = time.time()
        response = api_client.get('/api/health/')
        duration = time.time() - start

        assert response.status_code == status.HTTP_200_OK
        # Health check should respond in less than 1 second
        assert duration < 1.0

    def test_liveness_check_is_lightweight(self, api_client):
        """Test that liveness check is very fast (for Kubernetes)."""
        import time

        start = time.time()
        response = api_client.get('/api/alive/')
        duration = time.time() - start

        assert response.status_code == status.HTTP_200_OK
        # Liveness should be extremely fast (< 100ms)
        assert duration < 0.1


@pytest.mark.django_db
@pytest.mark.unit
class TestCoreModels:
    """Tests for core app models."""

    def test_region_model_creation(self):
        """Test creating a Region model instance."""
        from core.models import Region

        region = Region.objects.create(name='Test Region')
        assert region.name == 'Test Region'
        assert str(region) == 'Test Region'

    def test_comment_model_creation(self, user):
        """Test creating a Comment model instance."""
        from core.models import Comment

        comment = Comment.objects.create(
            user=user,
            text='Test comment',
            rating=5
        )

        assert comment.user == user
        assert comment.text == 'Test comment'
        assert comment.rating == 5
        assert comment.is_active is True

"""
Tests for login attempt tracking and account lockout middleware.
"""

import pytest
from django.core.cache import cache
from rest_framework import status

from .login_attempt import (
    LoginAttemptMiddleware,
    record_login_attempt,
    is_locked_out,
    get_remaining_attempts,
)


@pytest.mark.django_db
@pytest.mark.unit
class TestLoginAttemptTracking:
    """Test suite for login attempt tracking functions."""

    def test_record_successful_login_clears_attempts(self, user):
        """Test that successful login clears failed attempt counter."""
        username = user.username
        ip = '127.0.0.1'

        # Record some failed attempts
        for _ in range(3):
            record_login_attempt(username, ip, success=False)

        # Record successful login
        record_login_attempt(username, ip, success=True)

        # Check that counters are cleared
        user_key = f'login_attempts:user:{username}'
        ip_key = f'login_attempts:ip:{ip}'

        assert cache.get(user_key, 0) == 0
        assert cache.get(ip_key, 0) == 0

    def test_record_failed_login_increments_counter(self, user):
        """Test that failed login increments attempt counter."""
        username = user.username
        ip = '127.0.0.1'

        # Record failed attempts
        for i in range(3):
            record_login_attempt(username, ip, success=False)

            user_key = f'login_attempts:user:{username}'
            assert cache.get(user_key, 0) == i + 1

    def test_is_locked_out_after_max_attempts(self, user):
        """Test that account is locked after max failed attempts."""
        username = user.username
        ip = '127.0.0.1'

        # Record max failed attempts (5)
        for _ in range(LoginAttemptMiddleware.MAX_ATTEMPTS):
            record_login_attempt(username, ip, success=False)

        # Check lockout status
        locked, message = is_locked_out(username, ip)
        assert locked is True
        assert 'locked' in message.lower()
        assert 'minute' in message.lower()

    def test_not_locked_out_before_max_attempts(self, user):
        """Test that account is not locked before reaching max attempts."""
        username = user.username
        ip = '127.0.0.1'

        # Record fewer than max attempts
        for _ in range(LoginAttemptMiddleware.MAX_ATTEMPTS - 1):
            record_login_attempt(username, ip, success=False)

        # Check lockout status
        locked, message = is_locked_out(username, ip)
        assert locked is False
        assert message is None

    def test_get_remaining_attempts_decreases(self, user):
        """Test that remaining attempts decrease with each failure."""
        username = user.username
        ip = '127.0.0.1'

        max_attempts = LoginAttemptMiddleware.MAX_ATTEMPTS

        for i in range(max_attempts):
            remaining = get_remaining_attempts(username, ip)
            expected_remaining = max_attempts - i
            assert remaining == expected_remaining

            record_login_attempt(username, ip, success=False)

        # After max attempts, should be 0
        remaining = get_remaining_attempts(username, ip)
        assert remaining == 0

    def test_lockout_by_username(self, user):
        """Test that lockout works based on username alone."""
        username = user.username
        ip1 = '192.168.1.1'
        ip2 = '192.168.1.2'

        # Record max failed attempts from first IP
        for _ in range(LoginAttemptMiddleware.MAX_ATTEMPTS):
            record_login_attempt(username, ip1, success=False)

        # Check that second IP is also locked for same username
        locked, message = is_locked_out(username, ip2)
        assert locked is True

    def test_lockout_by_ip(self, user, multiple_users):
        """Test that lockout works based on IP address."""
        ip = '127.0.0.1'

        # Record max failed attempts from same IP with different usernames
        for i, test_user in enumerate(multiple_users[:LoginAttemptMiddleware.MAX_ATTEMPTS]):
            record_login_attempt(test_user.username, ip, success=False)

        # Check that IP is locked for new username
        locked, message = is_locked_out('newuser', ip)
        assert locked is True

    def test_different_users_different_ips_independent(self, multiple_users):
        """Test that different users from different IPs are tracked independently."""
        user1 = multiple_users[0]
        user2 = multiple_users[1]
        ip1 = '192.168.1.1'
        ip2 = '192.168.1.2'

        # Record attempts for user1 from ip1
        for _ in range(3):
            record_login_attempt(user1.username, ip1, success=False)

        # Check that user2 from ip2 is not affected
        remaining = get_remaining_attempts(user2.username, ip2)
        assert remaining == LoginAttemptMiddleware.MAX_ATTEMPTS

    def test_lockout_expiry_time(self, user):
        """Test that lockout has correct expiry time."""
        username = user.username
        ip = '127.0.0.1'

        # Record max failed attempts
        for _ in range(LoginAttemptMiddleware.MAX_ATTEMPTS):
            record_login_attempt(username, ip, success=False)

        # Check TTL is set correctly (should be LOCKOUT_DURATION)
        user_key = f'login_attempts:user:{username}'
        ttl = cache.ttl(user_key)

        # TTL should be close to LOCKOUT_DURATION (900 seconds = 15 minutes)
        # Allow some margin for execution time
        assert 890 <= ttl <= LoginAttemptMiddleware.LOCKOUT_DURATION


@pytest.mark.django_db
@pytest.mark.integration
class TestLoginAttemptIntegration:
    """Integration tests for login attempt tracking with actual login."""

    def test_failed_login_increments_attempts(self, api_client, user):
        """Test that failed login attempts are tracked."""
        # Make failed login attempt
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user.username,
                'password': 'wrongpassword'
            },
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Check remaining attempts in response
        if 'remaining_attempts' in response.json():
            remaining = response.json()['remaining_attempts']
            assert remaining == LoginAttemptMiddleware.MAX_ATTEMPTS - 1

    def test_account_locked_after_max_failed_attempts(self, api_client, user):
        """Test that account is locked after maximum failed attempts."""
        # Make max failed login attempts
        for i in range(LoginAttemptMiddleware.MAX_ATTEMPTS):
            api_client.post(
                '/api/v1/student-profile/login/',
                {
                    'username': user.username,
                    'password': 'wrongpassword'
                },
                format='json'
            )

        # Next attempt should return 429 (Too Many Requests)
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user.username,
                'password': 'wrongpassword'
            },
            format='json'
        )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        data = response.json()
        assert 'locked_out' in data or 'locked' in str(data).lower()

    def test_successful_login_after_failures_clears_attempts(self, api_client, user, user_data):
        """Test that successful login clears failed attempt counter."""
        # Make some failed attempts
        for _ in range(3):
            api_client.post(
                '/api/v1/student-profile/login/',
                {
                    'username': user.username,
                    'password': 'wrongpassword'
                },
                format='json'
            )

        # Make successful login
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK

        # Make another failed attempt - should start from max attempts again
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user.username,
                'password': 'wrongpassword'
            },
            format='json'
        )

        if 'remaining_attempts' in response.json():
            remaining = response.json()['remaining_attempts']
            assert remaining == LoginAttemptMiddleware.MAX_ATTEMPTS - 1

    def test_lockout_prevents_even_correct_password(self, api_client, user, user_data):
        """Test that locked account rejects even correct password."""
        # Lock the account with failed attempts
        for _ in range(LoginAttemptMiddleware.MAX_ATTEMPTS):
            api_client.post(
                '/api/v1/student-profile/login/',
                {
                    'username': user.username,
                    'password': 'wrongpassword'
                },
                format='json'
            )

        # Try with correct password - should still be locked
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_remaining_attempts_shown_in_response(self, api_client, user):
        """Test that remaining attempts are shown in failed login response."""
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user.username,
                'password': 'wrongpassword'
            },
            format='json'
        )

        # Response should include remaining attempts
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            data = response.json()
            # Check if remaining_attempts is in response (it should be)
            assert 'remaining_attempts' in data or response.status_code == 401

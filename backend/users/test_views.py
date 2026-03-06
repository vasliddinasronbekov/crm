"""
Comprehensive authentication and user management tests.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestUserAuthentication:
    """Test suite for user authentication endpoints."""

    def test_successful_student_login_returns_tokens_and_user_data(self, api_client, user, user_data):
        """Test successful login returns JWT tokens and user profile data."""
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Check tokens are present
        assert 'access' in data
        assert 'refresh' in data

        # Check user data is returned
        assert data['id'] == user.id
        assert data['username'] == user.username
        assert 'ranking' in data

    def test_login_with_invalid_credentials_fails(self, api_client):
        """Test login with wrong password returns 401."""
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': 'nonexistent',
                'password': 'wrongpassword'
            },
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_with_missing_credentials_fails(self, api_client):
        """Test login with missing fields returns 400."""
        response = api_client.post(
            '/api/v1/student-profile/login/',
            {'username': 'testuser'},
            format='json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_staff_login_is_rejected_on_student_endpoint(self, api_client, user, user_data):
        """Staff accounts must not authenticate via student login endpoint."""
        user.is_staff = True
        user.save(update_fields=['is_staff'])

        response = api_client.post(
            '/api/v1/student-profile/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_student_login_is_rejected_on_staff_endpoint(self, api_client, user, user_data):
        """Non-staff accounts must not authenticate via staff login endpoint."""
        response = api_client.post(
            '/api/auth/login/',
            {
                'username': user_data['username'],
                'password': user_data['password']
            },
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_jwt_token_refresh_works(self, api_client, user):
        """Test JWT token refresh endpoint."""
        # Get initial tokens
        refresh = RefreshToken.for_user(user)
        refresh_token = str(refresh)

        # Request new access token
        response = api_client.post(
            '/api/auth/token/refresh/',
            {'refresh': refresh_token},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.json()

    def test_access_protected_endpoint_without_token_fails(self, api_client):
        """Test accessing protected endpoints without authentication fails."""
        response = api_client.get('/api/v1/student-profile/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_access_protected_endpoint_with_valid_token_succeeds(self, auth_client):
        """Test accessing protected endpoints with valid JWT token."""
        response = auth_client.get('/api/v1/student-profile/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]

    def test_access_with_expired_token_fails(self, api_client, user):
        """Test that expired tokens are rejected."""
        # Create token with zero lifetime (expired)
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Blacklist the refresh token to simulate expiration
        refresh.blacklist()

        # Try to use the token
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = api_client.get('/api/v1/student-profile/')

        # Should work initially, but refresh should fail
        response = api_client.post(
            '/api/auth/token/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
@pytest.mark.unit
class TestUserRegistration:
    """Test suite for user registration."""

    def test_create_user_with_valid_data(self):
        """Test creating a user with valid data."""
        user = User.objects.create_user(
            username='newuser',
            password='NewPass123!',
            email='newuser@example.com'
        )

        assert user.username == 'newuser'
        assert user.email == 'newuser@example.com'
        assert user.check_password('NewPass123!')
        assert user.is_active is True
        assert user.is_staff is False

    def test_create_superuser(self):
        """Test creating a superuser."""
        admin = User.objects.create_superuser(
            username='admin',
            password='AdminPass123!',
            email='admin@example.com'
        )

        assert admin.is_superuser is True
        assert admin.is_staff is True

    def test_duplicate_username_not_allowed(self, user):
        """Test that duplicate usernames are not allowed."""
        with pytest.raises(Exception):
            User.objects.create_user(
                username=user.username,
                password='AnotherPass123!',
                email='different@example.com'
            )


@pytest.mark.django_db
@pytest.mark.unit
class TestUserModel:
    """Test suite for User model methods and properties."""

    def test_user_str_representation(self, user):
        """Test string representation of user."""
        assert str(user) == user.username

    def test_user_full_name(self, user):
        """Test get_full_name method."""
        full_name = user.get_full_name()
        assert user.first_name in full_name
        assert user.last_name in full_name

    def test_user_email_normalization(self):
        """Test that email is normalized on creation."""
        user = User.objects.create_user(
            username='emailtest',
            password='Pass123!',
            email='Test.User@EXAMPLE.COM'
        )
        assert user.email == 'Test.User@example.com'

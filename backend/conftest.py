"""
Pytest configuration and shared fixtures for EDU Platform backend tests.
"""

import pytest
from django.core.cache import cache

@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before each test to ensure clean state."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    """Provides an unauthenticated API client."""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def user_data():
    """Provides sample user data for tests."""
    return {
        'username': 'testuser',
        'password': 'TestPass123!',
        'email': 'testuser@example.com',
        'first_name': 'Test',
        'last_name': 'User',
    }


@pytest.fixture
def user(db, user_data):
    """Creates and returns a test user."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(
        username=user_data['username'],
        password=user_data['password'],
        email=user_data['email'],
        first_name=user_data['first_name'],
        last_name=user_data['last_name'],
    )


@pytest.fixture
def superuser(db):
    """Creates and returns a superuser."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_superuser(
        username='admin',
        password='AdminPass123!',
        email='admin@example.com',
    )


@pytest.fixture
def auth_client(api_client, user):
    """Provides an authenticated API client with JWT token."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.fixture
def authenticated_client(auth_client):
    """Backward-compatible alias used across older test files."""
    return auth_client


@pytest.fixture
def admin_client(api_client, superuser):
    """Provides an authenticated API client with admin user."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(superuser)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.fixture
def multiple_users(db):
    """Creates multiple test users for batch operations."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    users = []
    for i in range(5):
        user = User.objects.create_user(
            username=f'testuser{i}',
            password='TestPass123!',
            email=f'testuser{i}@example.com',
            first_name=f'Test{i}',
            last_name=f'User{i}',
        )
        users.append(user)
    return users


@pytest.fixture
def student_profile_data():
    """Provides sample student profile data."""
    return {
        'phone': '+998901234567',
        'birthday': '2000-01-15',
        'gender': 'male',
        'region': 'Tashkent',
    }

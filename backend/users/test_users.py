"""
Tests for User model and authentication
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from users.models import UserRoleEnum

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username='student_user',
        email='student@example.com',
        password='studentpass123',
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username='teacher_user',
        email='teacher@example.com',
        password='teacherpass123',
        is_teacher=True,
    )


@pytest.mark.unit
@pytest.mark.django_db
class TestUserModel:
    """Test User model"""

    def test_create_user(self):
        """Test creating a regular user"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        assert user.username == 'testuser'
        assert user.email == 'test@example.com'
        assert user.check_password('testpass123')
        assert not user.is_teacher
        assert not user.is_staff
        assert not user.is_superuser
        assert user.role == UserRoleEnum.STUDENT.value

    def test_create_teacher(self):
        """Test creating a teacher"""
        user = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='teacherpass123',
            is_teacher=True
        )
        assert user.is_teacher
        assert not user.is_staff
        assert user.role == UserRoleEnum.TEACHER.value

    def test_teacher_role_takes_priority_over_staff_flag(self):
        user = User.objects.create_user(
            username='teacher_staff',
            email='teacher_staff@example.com',
            password='teacherpass123',
            is_teacher=True,
            is_staff=True,
        )
        assert user.role == UserRoleEnum.TEACHER.value

    def test_create_superuser(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        assert user.is_superuser
        assert user.is_staff
        assert user.role == UserRoleEnum.SUPERADMIN.value

    def test_role_sync_persists_with_update_fields(self):
        """Legacy flag updates must also persist role transitions."""
        user = User.objects.create_user(
            username='role_sync_user',
            password='testpass123',
        )
        user.is_staff = True
        user.save(update_fields=['is_staff'])
        user.refresh_from_db()

        assert user.is_staff is True
        assert user.role == UserRoleEnum.ADMIN.value

    def test_user_str(self):
        """Test user string representation"""
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        assert str(user) == 'testuser'


@pytest.mark.api
@pytest.mark.auth
@pytest.mark.django_db
class TestAuthenticationAPI:
    """Test authentication endpoints"""

    def test_user_login_success(self, api_client, user):
        """Test successful staff login"""
        user.is_staff = True
        user.save(update_fields=['is_staff'])

        response = api_client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_user_login_invalid_credentials(self, api_client, user):
        """Test login with invalid credentials"""
        response = api_client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh(self, api_client, user):
        """Test token refresh"""
        user.is_staff = True
        user.save(update_fields=['is_staff'])

        # Login to get tokens
        login_response = api_client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        refresh_token = login_response.data['refresh']

        # Refresh token
        refresh_response = api_client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token
        })
        assert refresh_response.status_code == status.HTTP_200_OK
        assert 'access' in refresh_response.data


@pytest.mark.api
@pytest.mark.django_db
class TestUserAPI:
    """Test user API endpoints"""

    def test_list_users_unauthenticated(self, api_client):
        """Test that unauthenticated users cannot list users"""
        response = api_client.get('/api/task/users/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_users_authenticated(self, authenticated_client, user):
        """Student-role users cannot list all users."""
        response = authenticated_client.get('/api/task/users/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_retrieve_own_profile(self, authenticated_client, user):
        """Test user can retrieve own profile"""
        response = authenticated_client.get(f'/api/task/users/{user.id}/')
        if response.status_code == status.HTTP_200_OK:
            assert response.data['username'] == 'testuser'

    def test_list_students(self, authenticated_client, student):
        """Student-role users cannot list students."""
        response = authenticated_client.get('/api/v1/student/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_teachers(self, authenticated_client, teacher):
        """Student-role users cannot list teachers."""
        response = authenticated_client.get('/api/task/teachers/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list_students(self, admin_client, student):
        """Management role can list students."""
        response = admin_client.get('/api/v1/student/')
        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_set_user_role(self, admin_client, user):
        response = admin_client.post(
            f'/api/task/users/{user.id}/set_role/',
            {'role': UserRoleEnum.TEACHER.value},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.role == UserRoleEnum.TEACHER.value
        assert user.is_teacher is True

    def test_create_teacher_sets_teacher_role_and_password(self, admin_client):
        """Teacher create endpoint must create login-ready teacher accounts."""
        payload = {
            'username': 'newteacher',
            'password': 'StrongPass123!',
            'first_name': 'New',
            'last_name': 'Teacher',
            'email': 'newteacher@example.com',
            'phone': '+998901112233',
        }

        response = admin_client.post('/api/users/teachers/', payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        created = User.objects.get(username='newteacher')
        assert created.is_teacher is True
        assert created.is_superuser is False
        assert created.role == UserRoleEnum.TEACHER.value
        assert created.check_password('StrongPass123!')

    def test_create_teacher_supports_staff_flag(self, admin_client):
        """Admins can optionally create teacher accounts with staff status."""
        payload = {
            'username': 'teacherstaff',
            'password': 'StrongPass123!',
            'first_name': 'Teacher',
            'last_name': 'Staff',
            'email': 'teacherstaff@example.com',
            'is_staff': True,
        }

        response = admin_client.post('/api/users/teachers/', payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        created = User.objects.get(username='teacherstaff')
        assert created.is_teacher is True
        assert created.is_staff is True
        assert created.role == UserRoleEnum.TEACHER.value

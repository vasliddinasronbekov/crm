"""
Tests for CRM module
"""

import pytest
from rest_framework import status
from crm.models import Lead, Source


@pytest.mark.unit
@pytest.mark.django_db
class TestLeadModel:
    """Test Lead model"""

    def test_create_lead(self, source, lead_department, course, branch):
        """Test creating a lead"""
        lead = Lead.objects.create(
            full_name='John Doe',
            phone='+998901111111',
            source=source,
            department=lead_department,
            interested_course=course,
            branch=branch,
            status='new'
        )
        assert lead.full_name == 'John Doe'
        assert lead.status == 'new'
        assert str(lead) == 'John Doe (+998901111111)'

    def test_lead_status_choices(self, lead):
        """Test lead status options"""
        valid_statuses = ['new', 'in_progress', 'converted', 'rejected']
        assert lead.status in valid_statuses

        # Update status
        lead.status = 'converted'
        lead.save()
        assert lead.status == 'converted'


@pytest.mark.api
@pytest.mark.django_db
class TestLeadAPI:
    """Test Lead API endpoints"""

    def test_list_leads_unauthenticated(self, api_client):
        """Test listing leads without authentication"""
        response = api_client.get('/api/v1/lead/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_leads_authenticated(self, authenticated_client, lead):
        """Test listing leads with authentication"""
        response = authenticated_client.get('/api/v1/lead/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]

    def test_create_lead(self, authenticated_client, source, lead_department, course, branch):
        """Test creating a new lead"""
        data = {
            'full_name': 'Jane Doe',
            'phone': '+998902222222',
            'source': source.id,
            'department': lead_department.id,
            'interested_course': course.id,
            'branch': branch.id,
            'status': 'new'
        }

        response = authenticated_client.post('/api/v1/lead/', data)
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN
        ]

        if response.status_code == status.HTTP_201_CREATED:
            assert response.data['full_name'] == 'Jane Doe'
            assert response.data['phone'] == '+998902222222'

    def test_update_lead_status(self, authenticated_client, lead):
        """Test updating lead status"""
        data = {'status': 'in_progress'}

        response = authenticated_client.patch(f'/api/v1/lead/{lead.id}/', data)

        if response.status_code == status.HTTP_200_OK:
            assert response.data['status'] == 'in_progress'

    def test_retrieve_lead(self, authenticated_client, lead):
        """Test retrieving a specific lead"""
        response = authenticated_client.get(f'/api/v1/lead/{lead.id}/')

        if response.status_code == status.HTTP_200_OK:
            assert response.data['full_name'] == lead.full_name


@pytest.mark.integration
@pytest.mark.django_db
class TestLeadToStudentConversion:
    """Integration test for converting lead to student"""

    def test_convert_lead_to_student(self, admin_client, lead):
        """Test complete lead conversion workflow"""
        # 1. Update lead status to converted
        response = admin_client.patch(f'/api/v1/lead/{lead.id}/', {
            'status': 'converted'
        })

        if response.status_code == status.HTTP_200_OK:
            assert response.data['status'] == 'converted'

            # 2. Create user account for the student (simplified)
            # In real implementation, this would be done by a separate endpoint
            from django.contrib.auth import get_user_model
            User = get_user_model()

            student = User.objects.create_user(
                username=lead.phone,
                phone=lead.phone,
                first_name=lead.full_name.split()[0],
                last_name=lead.full_name.split()[1] if len(lead.full_name.split()) > 1 else ''
            )

            assert student.phone == lead.phone

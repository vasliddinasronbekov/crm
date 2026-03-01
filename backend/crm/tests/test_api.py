from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from crm.models import Lead, LeadSource, LeadDepartment

User = get_user_model()


class LeadAPITest(APITestCase):
    """Test cases for Lead API endpoints"""

    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123"
        )

        # Get JWT token
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)

        # Setup API client with authentication
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

        # Create test data
        self.source = LeadSource.objects.create(name="Test Source")
        self.department = LeadDepartment.objects.create(name="Test Department")

    def test_list_leads(self):
        """Test listing all leads"""
        # Create some leads
        Lead.objects.create(full_name="Lead 1", phone="+998901111111")
        Lead.objects.create(full_name="Lead 2", phone="+998902222222")

        response = self.client.get('/api/v1/lead/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    def test_create_lead(self):
        """Test creating a new lead"""
        data = {
            'full_name': 'New Lead',
            'phone': '+998903333333',
            'source': self.source.id,
            'status': 'new',
            'comment': 'Test comment'
        }

        response = self.client.post('/api/v1/lead/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['full_name'], 'New Lead')
        self.assertEqual(response.data['phone'], '+998903333333')

    def test_create_lead_minimal(self):
        """Test creating lead with only required fields"""
        data = {
            'full_name': 'Minimal Lead',
            'phone': '+998904444444'
        }

        response = self.client.post('/api/v1/lead/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_lead_invalid(self):
        """Test creating lead with invalid data"""
        data = {
            'full_name': '',  # Empty name
            'phone': 'invalid'  # Invalid phone
        }

        response = self.client.post('/api/v1/lead/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_lead(self):
        """Test retrieving a specific lead"""
        lead = Lead.objects.create(
            full_name="Retrieve Test",
            phone="+998905555555"
        )

        response = self.client.get(f'/api/v1/lead/{lead.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], "Retrieve Test")

    def test_update_lead(self):
        """Test updating a lead"""
        lead = Lead.objects.create(
            full_name="Update Test",
            phone="+998906666666",
            status="new"
        )

        data = {
            'full_name': 'Updated Name',
            'phone': '+998906666666',
            'status': 'in_progress'
        }

        response = self.client.put(f'/api/v1/lead/{lead.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Updated Name')
        self.assertEqual(response.data['status'], 'in_progress')

    def test_partial_update_lead(self):
        """Test partially updating a lead"""
        lead = Lead.objects.create(
            full_name="Patch Test",
            phone="+998907777777",
            status="new"
        )

        data = {'status': 'converted'}

        response = self.client.patch(f'/api/v1/lead/{lead.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'converted')

    def test_delete_lead(self):
        """Test deleting a lead"""
        lead = Lead.objects.create(
            full_name="Delete Test",
            phone="+998908888888"
        )

        response = self.client.delete(f'/api/v1/lead/{lead.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify lead is deleted
        self.assertFalse(Lead.objects.filter(id=lead.id).exists())

    def test_lead_filtering_by_status(self):
        """Test filtering leads by status"""
        Lead.objects.create(full_name="New Lead", phone="+998901111111", status="new")
        Lead.objects.create(full_name="Progress Lead", phone="+998902222222", status="in_progress")
        Lead.objects.create(full_name="Converted Lead", phone="+998903333333", status="converted")

        response = self.client.get('/api/v1/lead/?status=new')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'new')

    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        client = APIClient()  # No credentials
        response = client.get('/api/v1/lead/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LeadSourceAPITest(APITestCase):
    """Test cases for LeadSource API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="test123")
        refresh = RefreshToken.for_user(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

    def test_list_sources(self):
        """Test listing all lead sources"""
        LeadSource.objects.create(name="Instagram")
        LeadSource.objects.create(name="Facebook")

        response = self.client.get('/api/v1/source/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 2)

    def test_create_source(self):
        """Test creating a new lead source"""
        data = {
            'name': 'LinkedIn',
            'description': 'Leads from LinkedIn'
        }

        response = self.client.post('/api/v1/source/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'LinkedIn')


class LeadDepartmentAPITest(APITestCase):
    """Test cases for LeadDepartment API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="test123")
        refresh = RefreshToken.for_user(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

    def test_list_departments(self):
        """Test listing all departments"""
        LeadDepartment.objects.create(name="Programming")
        LeadDepartment.objects.create(name="Design")

        response = self.client.get('/api/v1/lead-department/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 2)

    def test_create_department(self):
        """Test creating a new department"""
        data = {
            'name': 'Data Science',
            'description': 'Data science courses'
        }

        response = self.client.post('/api/v1/lead-department/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Data Science')

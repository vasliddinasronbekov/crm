from django.test import TestCase
from django.contrib.auth import get_user_model
from crm.models import LeadSource, Lead, LeadDepartment

User = get_user_model()


class LeadSourceModelTest(TestCase):
    """Test cases for LeadSource model"""

    def setUp(self):
        self.source = LeadSource.objects.create(
            name="Website",
            description="Leads from website contact form"
        )

    def test_lead_source_creation(self):
        """Test LeadSource is created correctly"""
        self.assertEqual(self.source.name, "Website")
        self.assertEqual(self.source.description, "Leads from website contact form")
        self.assertTrue(self.source.is_active)

    def test_lead_source_str(self):
        """Test LeadSource string representation"""
        self.assertEqual(str(self.source), "Website")

    def test_lead_source_deactivation(self):
        """Test LeadSource can be deactivated"""
        self.source.is_active = False
        self.source.save()
        self.assertFalse(self.source.is_active)


class LeadDepartmentModelTest(TestCase):
    """Test cases for LeadDepartment model"""

    def setUp(self):
        self.department = LeadDepartment.objects.create(
            name="Programming",
            description="Programming courses department"
        )

    def test_department_creation(self):
        """Test LeadDepartment is created correctly"""
        self.assertEqual(self.department.name, "Programming")
        self.assertIsNotNone(self.department.created_at)

    def test_department_str(self):
        """Test LeadDepartment string representation"""
        self.assertEqual(str(self.department), "Programming")


class LeadModelTest(TestCase):
    """Test cases for Lead model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123"
        )
        self.source = LeadSource.objects.create(name="Instagram")
        self.department = LeadDepartment.objects.create(name="English")

    def test_lead_creation(self):
        """Test Lead is created with required fields"""
        lead = Lead.objects.create(
            full_name="John Doe",
            phone="+998901234567",
            source=self.source,
            status="new",
            responsible_person=self.user
        )
        self.assertEqual(lead.full_name, "John Doe")
        self.assertEqual(lead.phone, "+998901234567")
        self.assertEqual(lead.status, "new")
        self.assertIsNotNone(lead.created_at)

    def test_lead_str(self):
        """Test Lead string representation"""
        lead = Lead.objects.create(
            full_name="Jane Smith",
            phone="+998909876543"
        )
        self.assertEqual(str(lead), "Jane Smith")

    def test_lead_status_choices(self):
        """Test Lead status can be updated"""
        lead = Lead.objects.create(
            full_name="Test Lead",
            phone="+998901111111",
            status="new"
        )

        # Update status
        lead.status = "in_progress"
        lead.save()
        self.assertEqual(lead.status, "in_progress")

        # Convert to student
        lead.status = "converted"
        lead.save()
        self.assertEqual(lead.status, "converted")

    def test_lead_with_optional_fields(self):
        """Test Lead creation with all fields"""
        lead = Lead.objects.create(
            full_name="Complete Lead",
            phone="+998902222222",
            source=self.source,
            status="in_progress",
            interested_department=self.department,
            comment="Very interested in programming",
            responsible_person=self.user
        )
        self.assertEqual(lead.interested_department, self.department)
        self.assertIn("interested", lead.comment)
        self.assertEqual(lead.responsible_person, self.user)

    def test_lead_without_responsible_person(self):
        """Test Lead can be created without responsible person"""
        lead = Lead.objects.create(
            full_name="Unassigned Lead",
            phone="+998903333333"
        )
        self.assertIsNone(lead.responsible_person)

    def test_lead_ordering(self):
        """Test Leads are ordered by creation date"""
        lead1 = Lead.objects.create(full_name="First", phone="+998901111111")
        lead2 = Lead.objects.create(full_name="Second", phone="+998902222222")

        leads = Lead.objects.all()
        # Most recent first (descending order)
        self.assertEqual(leads[0], lead2)
        self.assertEqual(leads[1], lead1)

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from crm.activity_models import Activity
from crm.models import Lead, Source
from users.models import UserRoleEnum


User = get_user_model()


class LeadStageTransitionAPITest(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username='crm_staff',
            password='pass1234',
            role=UserRoleEnum.CRM_MANAGER.value,
        )
        self.student_user = User.objects.create_user(
            username='student_user',
            password='pass1234',
            role=UserRoleEnum.STUDENT.value,
        )
        self.source = Source.objects.create(name='Website')
        self.lead = Lead.objects.create(
            full_name='Transition Lead',
            phone='+998901234001',
            source=self.source,
            status='new',
            responsible_person=self.staff_user,
        )
        self.url = f'/api/crm/leads/{self.lead.id}/transition-stage/'

    def test_stage_transition_creates_activity_log(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.post(
            self.url,
            {'status': 'in_progress', 'note': 'Qualified by sales call'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'in_progress')

        activity = Activity.objects.filter(lead=self.lead).latest('created_at')
        self.assertEqual(activity.activity_type, 'status_change')
        self.assertEqual(activity.created_by, self.staff_user)
        self.assertIn('Stage transition', activity.subject)
        self.assertEqual(activity.description, 'Qualified by sales call')

    def test_invalid_transition_is_rejected(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.post(
            self.url,
            {'status': 'converted'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'new')

    def test_non_crm_role_cannot_transition(self):
        self.lead.responsible_person = self.student_user
        self.lead.save(update_fields=['responsible_person'])
        self.client.force_authenticate(self.student_user)

        response = self.client.post(
            self.url,
            {'status': 'in_progress'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

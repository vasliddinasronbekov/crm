import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from crm.models import Lead
from student_profile.models import Branch
from users.models import BranchMembership, User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_lead_list_and_create_are_branch_scoped():
    branch_a = Branch.objects.create(name='CRM Branch A')
    branch_b = Branch.objects.create(name='CRM Branch B')

    manager = User.objects.create_user(
        username='crm_scope_manager',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
    )
    BranchMembership.objects.create(
        user=manager,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    Lead.objects.create(
        full_name='Scoped Lead A',
        phone='+998901112233',
        responsible_person=manager,
        branch=branch_a,
    )
    Lead.objects.create(
        full_name='Scoped Lead B',
        phone='+998904445566',
        responsible_person=manager,
        branch=branch_b,
    )

    client = _auth_client_for_user(manager)

    list_response = client.get('/api/v1/lead/')
    assert list_response.status_code == status.HTTP_200_OK
    assert list_response.data['count'] == 1
    assert list_response.data['results'][0]['full_name'] == 'Scoped Lead A'

    create_response = client.post(
        '/api/v1/lead/',
        {
            'full_name': 'Auto Branch Lead',
            'phone': '+998907778899',
            'status': 'new',
        },
        format='json',
    )
    assert create_response.status_code == status.HTTP_201_CREATED
    created_lead = Lead.objects.get(id=create_response.data['id'])
    assert created_lead.branch_id == branch_a.id
    assert created_lead.responsible_person_id == manager.id

    cross_branch_response = client.post(
        '/api/v1/lead/',
        {
            'full_name': 'Cross Branch Lead',
            'phone': '+998900000111',
            'branch': branch_b.id,
            'status': 'new',
        },
        format='json',
    )
    assert cross_branch_response.status_code == status.HTTP_403_FORBIDDEN

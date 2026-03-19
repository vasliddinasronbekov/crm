import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch
from users.models import BranchMembership, User, UserRoleEnum
from .models import Conversation, MessageTemplate


def _auth_client_for_user(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.mark.django_db
def test_send_message_blocks_cross_branch_recipients(api_client):
    branch_a = Branch.objects.create(name='Messaging Branch A')
    branch_b = Branch.objects.create(name='Messaging Branch B')

    manager = User.objects.create_user(
        username='msg_scope_manager',
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

    recipient_a = User.objects.create_user(
        username='msg_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    recipient_b = User.objects.create_user(
        username='msg_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    client = _auth_client_for_user(api_client, manager)

    response = client.post(
        '/api/v1/send-message/',
        {
            'recipient_user_ids': [recipient_a.id, recipient_b.id],
            'message_text': 'Scoped message',
            'message_type': 'platform',
        },
        format='json',
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_conversation_create_blocks_cross_branch_participants(api_client):
    branch_a = Branch.objects.create(name='Conversation Branch A')
    branch_b = Branch.objects.create(name='Conversation Branch B')

    manager = User.objects.create_user(
        username='conv_scope_manager',
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

    in_branch_participant = User.objects.create_user(
        username='conv_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    out_branch_participant = User.objects.create_user(
        username='conv_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    client = _auth_client_for_user(api_client, manager)

    allowed_response = client.post(
        '/api/messaging/conversations/',
        {
            'title': 'Scoped Conversation',
            'participant_ids': [in_branch_participant.id],
            'conversation_type': 'platform',
        },
        format='json',
    )
    assert allowed_response.status_code == status.HTTP_201_CREATED

    blocked_response = client.post(
        '/api/messaging/conversations/',
        {
            'title': 'Cross Branch Conversation',
            'participant_ids': [out_branch_participant.id],
            'conversation_type': 'platform',
        },
        format='json',
    )
    assert blocked_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_message_template_management_is_global_only(api_client):
    branch_a = Branch.objects.create(name='Template Branch A')

    manager = User.objects.create_user(
        username='template_scope_manager',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    MessageTemplate.objects.create(name='Global Template', text='Hello')
    client = _auth_client_for_user(api_client, manager)

    list_response = client.get('/api/v1/message-template/')
    assert list_response.status_code == status.HTTP_200_OK
    payload = list_response.data['results'] if isinstance(list_response.data, dict) else list_response.data
    assert payload == []

    create_response = client.post(
        '/api/v1/message-template/',
        {'name': 'Local Template', 'text': 'Blocked'},
        format='json',
    )
    assert create_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_conversation_list_excludes_out_of_scope_legacy_participants(api_client):
    branch_a = Branch.objects.create(name='Conversation Scope Branch A')
    branch_b = Branch.objects.create(name='Conversation Scope Branch B')

    manager = User.objects.create_user(
        username='conv_list_scope_manager',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    participant_a = User.objects.create_user(
        username='conv_list_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    participant_b = User.objects.create_user(
        username='conv_list_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    in_scope = Conversation.objects.create(
        user=manager,
        conversation_type='platform',
        title='In Scope',
    )
    in_scope.participants.add(manager, participant_a)

    legacy_cross_branch = Conversation.objects.create(
        user=manager,
        conversation_type='platform',
        title='Legacy Cross Branch',
    )
    legacy_cross_branch.participants.add(manager, participant_b)

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/messaging/conversations/')
    assert response.status_code == status.HTTP_200_OK

    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    titles = {item['title'] for item in payload}
    assert 'In Scope' in titles
    assert 'Legacy Cross Branch' not in titles

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch
from users.models import BranchMembership, User, UserRoleEnum
from .models import Conversation, MessageTemplate
from .email_models import EmailCampaign, EmailTemplate, EmailLog


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


@pytest.mark.django_db
def test_chat_conversation_list_excludes_out_of_scope_legacy_participants(api_client):
    branch_a = Branch.objects.create(name='Chat Scope Branch A')
    branch_b = Branch.objects.create(name='Chat Scope Branch B')

    manager = User.objects.create_user(
        username='chat_scope_manager',
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
        username='chat_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    participant_b = User.objects.create_user(
        username='chat_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    in_scope = Conversation.objects.create(
        user=manager,
        conversation_type='platform',
        title='Chat In Scope',
    )
    in_scope.participants.add(manager, participant_a)

    legacy_cross_branch = Conversation.objects.create(
        user=manager,
        conversation_type='platform',
        title='Chat Legacy Cross Branch',
    )
    legacy_cross_branch.participants.add(manager, participant_b)

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/messaging/chat/conversations/')
    assert response.status_code == status.HTTP_200_OK

    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    titles = {item['title'] for item in payload}
    assert 'Chat In Scope' in titles
    assert 'Chat Legacy Cross Branch' not in titles


@pytest.mark.django_db
def test_attachment_upload_blocks_legacy_cross_branch_conversations(api_client):
    branch_a = Branch.objects.create(name='Chat Attachment Scope Branch A')
    branch_b = Branch.objects.create(name='Chat Attachment Scope Branch B')

    manager = User.objects.create_user(
        username='chat_attachment_scope_manager',
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

    participant_b = User.objects.create_user(
        username='chat_attachment_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    legacy_cross_branch = Conversation.objects.create(
        user=manager,
        conversation_type='platform',
        title='Attachment Legacy Cross Branch',
    )
    legacy_cross_branch.participants.add(manager, participant_b)

    client = _auth_client_for_user(api_client, manager)
    response = client.post(
        '/api/messaging/upload/',
        data={
            'conversation_id': legacy_cross_branch.id,
            'file': SimpleUploadedFile(
                'scope-check.txt',
                b'scope check',
                content_type='text/plain',
            ),
        },
        format='multipart',
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_email_campaign_list_excludes_legacy_cross_branch_custom_recipients(api_client):
    branch_a = Branch.objects.create(name='Email Campaign Scope Branch A')
    branch_b = Branch.objects.create(name='Email Campaign Scope Branch B')

    manager = User.objects.create_user(
        username='email_campaign_scope_manager',
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

    recipient_a = User.objects.create_user(
        username='email_campaign_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    recipient_b = User.objects.create_user(
        username='email_campaign_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    template = EmailTemplate.objects.create(
        name='Scope Template',
        template_type='custom',
        subject='Scope Subject',
        html_content='<p>Hello</p>',
        text_content='Hello',
        created_by=manager,
        is_active=True,
    )

    in_scope_campaign = EmailCampaign.objects.create(
        name='Email In Scope',
        template=template,
        subject='In Scope',
        html_content='<p>In Scope</p>',
        text_content='In Scope',
        recipient_type='custom_list',
        created_by=manager,
        status='draft',
    )
    in_scope_campaign.custom_recipients.add(recipient_a)

    mixed_campaign = EmailCampaign.objects.create(
        name='Email Legacy Cross Branch',
        template=template,
        subject='Mixed',
        html_content='<p>Mixed</p>',
        text_content='Mixed',
        recipient_type='custom_list',
        created_by=manager,
        status='draft',
    )
    mixed_campaign.custom_recipients.add(recipient_a, recipient_b)

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/v1/email/campaigns/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    campaign_ids = {item['id'] for item in payload}
    assert in_scope_campaign.id in campaign_ids
    assert mixed_campaign.id not in campaign_ids


@pytest.mark.django_db
def test_email_campaign_create_rejects_out_of_scope_template(api_client):
    branch_a = Branch.objects.create(name='Email Create Scope Branch A')
    branch_b = Branch.objects.create(name='Email Create Scope Branch B')

    manager_a = User.objects.create_user(
        username='email_create_scope_manager_a',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_a,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    manager_b = User.objects.create_user(
        username='email_create_scope_manager_b',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_b,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_b,
        branch=branch_b,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    recipient_a = User.objects.create_user(
        username='email_create_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )

    out_of_scope_template = EmailTemplate.objects.create(
        name='Out Scope Template',
        template_type='custom',
        subject='Out Scope',
        html_content='<p>Out Scope</p>',
        text_content='Out Scope',
        created_by=manager_b,
        is_active=True,
    )

    client = _auth_client_for_user(api_client, manager_a)
    response = client.post(
        '/api/v1/email/campaigns/',
        {
            'name': 'Blocked Campaign',
            'template': out_of_scope_template.id,
            'subject': 'Blocked',
            'html_content': '<p>Blocked</p>',
            'text_content': 'Blocked',
            'recipient_type': 'custom_list',
            'custom_recipients': [recipient_a.id],
        },
        format='json',
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_email_logs_exclude_cross_branch_recipients_for_scoped_staff(api_client):
    branch_a = Branch.objects.create(name='Email Logs Scope Branch A')
    branch_b = Branch.objects.create(name='Email Logs Scope Branch B')

    manager = User.objects.create_user(
        username='email_logs_scope_manager',
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

    recipient_a = User.objects.create_user(
        username='email_logs_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    recipient_b = User.objects.create_user(
        username='email_logs_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    template = EmailTemplate.objects.create(
        name='Email Logs Scope Template',
        template_type='custom',
        subject='Email Logs Scope',
        html_content='<p>Scope</p>',
        text_content='Scope',
        created_by=manager,
        is_active=True,
    )

    campaign = EmailCampaign.objects.create(
        name='Email Logs Scope Campaign',
        template=template,
        subject='Scope Campaign',
        html_content='<p>Scope campaign</p>',
        text_content='Scope campaign',
        recipient_type='custom_list',
        created_by=manager,
        status='sent',
    )

    in_scope_log = EmailLog.objects.create(
        campaign=campaign,
        template=template,
        recipient=recipient_a,
        recipient_email=recipient_a.email,
        subject='In Scope',
        status='sent',
    )
    out_scope_log = EmailLog.objects.create(
        campaign=campaign,
        template=template,
        recipient=recipient_b,
        recipient_email=recipient_b.email,
        subject='Out Scope',
        status='sent',
    )

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/v1/email/logs/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    log_ids = {item['id'] for item in payload}
    assert in_scope_log.id in log_ids
    assert out_scope_log.id not in log_ids


@pytest.mark.django_db
def test_superuser_active_branch_filter_scopes_email_campaign_reads(api_client):
    branch_a = Branch.objects.create(name='Email Super Scope Branch A')
    branch_b = Branch.objects.create(name='Email Super Scope Branch B')

    manager_a = User.objects.create_user(
        username='email_super_scope_manager_a',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_a,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_a,
        branch=branch_a,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    manager_b = User.objects.create_user(
        username='email_super_scope_manager_b',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_b,
        is_staff=True,
    )
    BranchMembership.objects.create(
        user=manager_b,
        branch=branch_b,
        role=UserRoleEnum.MANAGER.value,
        is_primary=True,
        is_active=True,
    )

    template_a = EmailTemplate.objects.create(
        name='Email Super Scope Template A',
        template_type='custom',
        subject='Scope A',
        html_content='<p>A</p>',
        text_content='A',
        created_by=manager_a,
        is_active=True,
    )
    template_b = EmailTemplate.objects.create(
        name='Email Super Scope Template B',
        template_type='custom',
        subject='Scope B',
        html_content='<p>B</p>',
        text_content='B',
        created_by=manager_b,
        is_active=True,
    )

    campaign_a = EmailCampaign.objects.create(
        name='Email Super Scope Campaign A',
        template=template_a,
        subject='Campaign A',
        html_content='<p>Campaign A</p>',
        text_content='Campaign A',
        recipient_type='all_students',
        created_by=manager_a,
        status='draft',
    )
    campaign_b = EmailCampaign.objects.create(
        name='Email Super Scope Campaign B',
        template=template_b,
        subject='Campaign B',
        html_content='<p>Campaign B</p>',
        text_content='Campaign B',
        recipient_type='all_students',
        created_by=manager_b,
        status='draft',
    )

    superuser = User.objects.create_superuser(
        username='email_super_scope_superuser',
        password='StrongPass123!',
        email='email_super_scope_superuser@example.com',
    )

    client = _auth_client_for_user(api_client, superuser)
    response = client.get(f'/api/v1/email/campaigns/?active_branch={branch_a.id}')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    campaign_ids = {item['id'] for item in payload}
    assert campaign_a.id in campaign_ids
    assert campaign_b.id not in campaign_ids

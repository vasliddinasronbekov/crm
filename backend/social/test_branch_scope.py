import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from datetime import date

from student_profile.models import Branch, Course, Group
from users.models import BranchMembership, User, UserRoleEnum

from .models import Conversation, Forum, ForumCategory, StudyGroup


def _auth_client_for_user(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.mark.django_db
def test_study_groups_and_posts_are_branch_scoped(api_client):
    branch_a = Branch.objects.create(name='Social Branch A')
    branch_b = Branch.objects.create(name='Social Branch B')

    manager = User.objects.create_user(
        username='social_scope_manager',
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

    foreign_creator = User.objects.create_user(
        username='social_scope_foreign',
        password='StrongPass123!',
        role=UserRoleEnum.MANAGER.value,
        branch=branch_b,
    )

    local_group = StudyGroup.objects.create(
        name='Local Study Group',
        description='Local',
        creator=manager,
        is_public=True,
        is_active=True,
    )
    foreign_group = StudyGroup.objects.create(
        name='Foreign Study Group',
        description='Foreign',
        creator=foreign_creator,
        is_public=True,
        is_active=True,
    )

    client = _auth_client_for_user(api_client, manager)

    list_response = client.get('/api/social/study-groups/')
    assert list_response.status_code == status.HTTP_200_OK
    payload = list_response.data['results'] if isinstance(list_response.data, dict) else list_response.data
    returned_ids = {item['id'] for item in payload}
    assert local_group.id in returned_ids
    assert foreign_group.id not in returned_ids

    blocked_post = client.post(
        '/api/social/group-posts/',
        {'group': foreign_group.id, 'content': 'Should be blocked'},
        format='json',
    )
    assert blocked_post.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_forums_require_auth_and_stay_branch_scoped(api_client):
    unauthenticated_response = api_client.get('/api/social/forums/')
    assert unauthenticated_response.status_code == status.HTTP_401_UNAUTHORIZED

    branch_a = Branch.objects.create(name='Forum Branch A')
    branch_b = Branch.objects.create(name='Forum Branch B')

    manager = User.objects.create_user(
        username='forum_scope_manager',
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

    category = ForumCategory.objects.create(name='General')
    course_a = Course.objects.create(name='Forum Course A', price=500_000, duration_months=1)
    course_b = Course.objects.create(name='Forum Course B', price=500_000, duration_months=1)
    Group.objects.create(
        name='Forum Group A',
        branch=branch_a,
        course=course_a,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='09:00',
        end_time='10:00',
        days='Mon,Wed,Fri',
    )
    Group.objects.create(
        name='Forum Group B',
        branch=branch_b,
        course=course_b,
        start_day=date(2026, 1, 1),
        end_day=date(2026, 12, 31),
        start_time='11:00',
        end_time='12:00',
        days='Tue,Thu,Sat',
    )

    in_scope_forum = Forum.objects.create(
        category=category,
        course=course_a,
        name='In Scope Forum',
        description='Visible',
        is_active=True,
    )
    out_scope_forum = Forum.objects.create(
        category=category,
        course=course_b,
        name='Out Scope Forum',
        description='Hidden',
        is_active=True,
    )

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/social/forums/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    forum_ids = {item['id'] for item in payload}
    assert in_scope_forum.id in forum_ids
    assert out_scope_forum.id not in forum_ids


@pytest.mark.django_db
def test_social_conversation_list_excludes_cross_branch_legacy_threads(api_client):
    branch_a = Branch.objects.create(name='Social Conversation Branch A')
    branch_b = Branch.objects.create(name='Social Conversation Branch B')

    manager = User.objects.create_user(
        username='social_conv_scope_manager',
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

    participant_a = User.objects.create_user(
        username='social_conv_scope_user_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    participant_b = User.objects.create_user(
        username='social_conv_scope_user_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    in_scope = Conversation.objects.create(conversation_type='direct', creator=manager)
    in_scope.participants.add(manager, participant_a)

    legacy_cross_branch = Conversation.objects.create(conversation_type='direct', creator=manager)
    legacy_cross_branch.participants.add(manager, participant_b)

    client = _auth_client_for_user(api_client, manager)
    response = client.get('/api/social/conversations/')
    assert response.status_code == status.HTTP_200_OK
    payload = response.data['results'] if isinstance(response.data, dict) else response.data
    returned_ids = {item['id'] for item in payload}
    assert in_scope.id in returned_ids
    assert legacy_cross_branch.id not in returned_ids

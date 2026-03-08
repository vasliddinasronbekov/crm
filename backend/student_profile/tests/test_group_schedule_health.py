import datetime

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone

from student_profile.models import Branch, Course, Group, Room
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
def test_schedule_health_reports_conflicts_for_visible_groups():
    branch = Branch.objects.create(name='Main Branch')
    room = Room.objects.create(name='Room 101', capacity=10, branch=branch)
    course = Course.objects.create(name='IELTS', price=12000000, duration_months=3)
    teacher = User.objects.create_user(
        username='teacher_conflict',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )

    Group.objects.create(
        name='IELTS A',
        branch=branch,
        course=course,
        room=room,
        main_teacher=teacher,
        start_day=datetime.date(2026, 1, 1),
        end_day=datetime.date(2026, 3, 31),
        start_time=datetime.time(9, 0),
        end_time=datetime.time(11, 0),
        days='Mon, Wed, Fri',
    )
    Group.objects.create(
        name='IELTS B',
        branch=branch,
        course=course,
        room=room,
        main_teacher=teacher,
        start_day=datetime.date(2026, 1, 10),
        end_day=datetime.date(2026, 3, 20),
        start_time=datetime.time(10, 0),
        end_time=datetime.time(12, 0),
        days='Mon, Wed',
    )

    client = _auth_client_for_user(teacher)
    response = client.get('/api/student-profile/groups/schedule-health/')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['scheduled_groups'] == 2
    assert response.data['room_conflicts'] >= 1
    assert response.data['teacher_conflicts'] >= 1
    assert isinstance(response.data['top_conflicts'], list)


@pytest.mark.django_db
def test_student_cannot_create_group_with_capability_guard():
    student = User.objects.create_user(
        username='student_no_group_create',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    branch = Branch.objects.create(name='Branch 1')
    room = Room.objects.create(name='Room 1', capacity=20, branch=branch)
    course = Course.objects.create(name='Math', price=5000000, duration_months=4)

    client = _auth_client_for_user(student)
    response = client.post(
        '/api/student-profile/groups/',
        {
            'name': 'Should Fail',
            'branch': branch.id,
            'course': course.id,
            'room': room.id,
            'start_day': '2026-01-01',
            'end_day': '2026-02-01',
            'start_time': '09:00:00',
            'end_time': '10:00:00',
            'days': 'Mon, Wed',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_group_creation_blocks_schedule_conflicts():
    branch = Branch.objects.create(name='Branch 2')
    room = Room.objects.create(name='Room 2', capacity=12, branch=branch)
    course = Course.objects.create(name='Physics', price=7000000, duration_months=2)
    manager = User.objects.create_user(
        username='manager_group_create',
        password='TestPass123!',
        role=UserRoleEnum.MANAGER.value,
    )

    Group.objects.create(
        name='Physics Morning',
        branch=branch,
        course=course,
        room=room,
        start_day=datetime.date(2026, 1, 1),
        end_day=datetime.date(2026, 5, 1),
        start_time=datetime.time(9, 0),
        end_time=datetime.time(11, 0),
        days='Tue, Thu',
    )

    client = _auth_client_for_user(manager)
    response = client.post(
        '/api/student-profile/groups/',
        {
            'name': 'Physics Overlap',
            'branch': branch.id,
            'course': course.id,
            'room': room.id,
            'start_day': '2026-02-01',
            'end_day': '2026-06-01',
            'start_time': '10:30:00',
            'end_time': '12:00:00',
            'days': 'Tue, Thu',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'schedule_conflicts' in response.data


@pytest.mark.django_db
def test_teacher_cannot_create_group_without_groups_manage_capability():
    teacher = User.objects.create_user(
        username='teacher_no_group_manage',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    branch = Branch.objects.create(name='Branch 3')
    room = Room.objects.create(name='Room 3', capacity=16, branch=branch)
    course = Course.objects.create(name='Chemistry', price=6500000, duration_months=4)

    client = _auth_client_for_user(teacher)
    response = client.post(
        '/api/student-profile/groups/',
        {
            'name': 'Teacher Group',
            'branch': branch.id,
            'course': course.id,
            'room': room.id,
            'start_day': '2026-01-01',
            'end_day': '2026-04-01',
            'start_time': '09:00:00',
            'end_time': '10:00:00',
            'days': 'Mon, Wed',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_ongoing_groups_returns_only_currently_running_groups():
    branch = Branch.objects.create(name='Branch Ongoing')
    room = Room.objects.create(name='Room Ongoing', capacity=20, branch=branch)
    course = Course.objects.create(name='Biology', price=8200000, duration_months=4)
    manager = User.objects.create_user(
        username='manager_ongoing_groups',
        password='TestPass123!',
        role=UserRoleEnum.MANAGER.value,
    )

    now_local = timezone.localtime(timezone.now())
    today = now_local.date()
    now_time = now_local.time().replace(second=0, microsecond=0)
    start_time = (datetime.datetime.combine(today, now_time) - datetime.timedelta(minutes=45)).time()
    end_time = (datetime.datetime.combine(today, now_time) + datetime.timedelta(minutes=45)).time()
    closed_start = (datetime.datetime.combine(today, now_time) - datetime.timedelta(hours=3)).time()
    closed_end = (datetime.datetime.combine(today, now_time) - datetime.timedelta(hours=2)).time()
    today_token = now_local.strftime('%a')

    ongoing_group = Group.objects.create(
        name='Biology Ongoing',
        branch=branch,
        course=course,
        room=room,
        start_day=today - datetime.timedelta(days=7),
        end_day=today + datetime.timedelta(days=30),
        start_time=start_time,
        end_time=end_time,
        days=today_token,
    )
    ranged_group = Group.objects.create(
        name='Biology Range Token',
        branch=branch,
        course=course,
        room=room,
        start_day=today - datetime.timedelta(days=7),
        end_day=today + datetime.timedelta(days=30),
        start_time=start_time,
        end_time=end_time,
        days='Mon-Sun',
    )
    Group.objects.create(
        name='Biology Completed',
        branch=branch,
        course=course,
        room=room,
        start_day=today - datetime.timedelta(days=7),
        end_day=today + datetime.timedelta(days=30),
        start_time=closed_start,
        end_time=closed_end,
        days=today_token,
    )

    client = _auth_client_for_user(manager)
    response = client.get('/api/student-profile/groups/ongoing/')

    assert response.status_code == status.HTTP_200_OK
    result_ids = {row['id'] for row in response.data['results']}
    assert response.data['count'] == 2
    assert ongoing_group.id in result_ids
    assert ranged_group.id in result_ids
    for row in response.data['results']:
        assert row['is_ongoing'] is True
        assert row['minutes_since_start'] >= 0
        assert row['minutes_until_end'] >= 0

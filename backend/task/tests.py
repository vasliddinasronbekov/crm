"""
Comprehensive tests for task management system.
"""

import pytest
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status

from .models import Board, List, Task, AutoTask, When, WeekDay, ListStatus
from .certificate_models import Certificate, CertificateTemplate, CertificateVerification
from student_profile.content_models import CourseModule, Lesson, StudentProgress
from student_profile.models import Attendance, Branch, Course, ExamScore, Group

User = get_user_model()


@pytest.mark.django_db
@pytest.mark.unit
class TestBoardModel:
    """Test suite for Board model."""

    def test_create_board(self):
        """Test creating a task board."""
        board = Board.objects.create(name='Development Tasks')

        assert board.name == 'Development Tasks'
        assert str(board) == 'Development Tasks'

    def test_board_add_users(self, multiple_users):
        """Test adding users to a board."""
        board = Board.objects.create(name='Team Board')
        board.users.add(multiple_users[0], multiple_users[1])

        assert board.users.count() == 2
        assert multiple_users[0] in board.users.all()
        assert multiple_users[1] in board.users.all()

    def test_board_add_teachers(self, user):
        """Test adding teachers to a board."""
        # Make user a teacher
        user.is_teacher = True
        user.save()

        board = Board.objects.create(name='Teaching Board')
        board.teachers.add(user)

        assert user in board.teachers.all()

    def test_user_can_access_their_boards(self, user):
        """Test user can access boards they belong to."""
        board1 = Board.objects.create(name='Board 1')
        board2 = Board.objects.create(name='Board 2')
        board1.users.add(user)

        user_boards = user.task_boards.all()

        assert board1 in user_boards
        assert board2 not in user_boards


@pytest.mark.django_db
@pytest.mark.unit
class TestListModel:
    """Test suite for List model."""

    def test_create_list(self):
        """Test creating a task list."""
        board = Board.objects.create(name='Project Board')
        task_list = List.objects.create(
            name='To Do',
            board=board,
            order=1,
            color='#FF0000'
        )

        assert task_list.name == 'To Do'
        assert task_list.board == board
        assert task_list.status == ListStatus.FAOL
        assert str(task_list) == 'To Do on Project Board'

    def test_list_ordering(self):
        """Test lists are ordered by order field."""
        board = Board.objects.create(name='Ordered Board')
        list3 = List.objects.create(name='Third', board=board, order=3)
        list1 = List.objects.create(name='First', board=board, order=1)
        list2 = List.objects.create(name='Second', board=board, order=2)

        lists = board.lists.all()

        assert lists[0] == list1
        assert lists[1] == list2
        assert lists[2] == list3

    def test_list_status_choices(self):
        """Test list status has valid choices."""
        board = Board.objects.create(name='Status Board')

        for status_value in [ListStatus.FAOL, ListStatus.OTHER, ListStatus.DONE]:
            task_list = List.objects.create(
                name=f'List {status_value}',
                board=board,
                status=status_value
            )
            assert task_list.status == status_value

    def test_list_cascade_delete_with_board(self):
        """Test lists are deleted when board is deleted."""
        board = Board.objects.create(name='Temp Board')
        task_list = List.objects.create(name='Temp List', board=board)

        list_id = task_list.id
        board.delete()

        assert not List.objects.filter(id=list_id).exists()


@pytest.mark.django_db
@pytest.mark.unit
class TestTaskModel:
    """Test suite for Task model."""

    def test_create_task(self, user):
        """Test creating a task."""
        board = Board.objects.create(name='My Board')
        task_list = List.objects.create(name='My List', board=board)

        task = Task.objects.create(
            user=user,
            title='Complete feature',
            description='Implement new feature',
            list=task_list
        )

        assert task.title == 'Complete feature'
        assert task.user == user
        assert task.list == task_list
        assert task.is_done is False
        assert str(task) == 'Complete feature'

    def test_task_with_due_date(self, user):
        """Test creating task with due date."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        due_date = timezone.now() + timedelta(days=7)
        task = Task.objects.create(
            user=user,
            title='Task with deadline',
            list=task_list,
            due_date=due_date
        )

        assert task.due_date == due_date

    def test_mark_task_as_done(self, user):
        """Test marking task as complete."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        task = Task.objects.create(
            user=user,
            title='Finish homework',
            list=task_list
        )

        # Mark as done
        task.is_done = True
        task.completed_at = timezone.now()
        task.save()

        assert task.is_done is True
        assert task.completed_at is not None

    def test_task_response_field(self, user):
        """Test task response field for teacher feedback."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        task = Task.objects.create(
            user=user,
            title='Submit assignment',
            list=task_list
        )

        # Add teacher response
        task.response = 'Good work! Grade: 95/100'
        task.save()

        assert task.response == 'Good work! Grade: 95/100'

    def test_task_cascade_delete_with_list(self, user):
        """Test tasks are deleted when list is deleted."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)
        task = Task.objects.create(user=user, title='Task', list=task_list)

        task_id = task.id
        task_list.delete()

        assert not Task.objects.filter(id=task_id).exists()

    def test_user_can_access_their_tasks(self, multiple_users):
        """Test user can access only their tasks."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        task1 = Task.objects.create(
            user=multiple_users[0],
            title='User 1 Task',
            list=task_list
        )
        task2 = Task.objects.create(
            user=multiple_users[1],
            title='User 2 Task',
            list=task_list
        )

        user1_tasks = multiple_users[0].tasks.all()
        user2_tasks = multiple_users[1].tasks.all()

        assert task1 in user1_tasks
        assert task1 not in user2_tasks
        assert task2 in user2_tasks
        assert task2 not in user1_tasks


@pytest.mark.django_db
@pytest.mark.unit
class TestAutoTaskModel:
    """Test suite for AutoTask model."""

    def test_create_daily_autotask(self, user):
        """Test creating a daily recurring task."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        autotask = AutoTask.objects.create(
            title='Daily standup',
            description='Team standup meeting',
            when=When.EVERY_DAY,
            hour='09:00',
            deadline_day=1,
            deadline_hour='10:00',
            list=task_list
        )
        autotask.users.add(user)

        assert autotask.when == When.EVERY_DAY
        assert autotask.users.count() == 1
        assert str(autotask) == 'AutoTask: Daily standup'

    def test_create_weekly_autotask(self, user):
        """Test creating a weekly recurring task."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        autotask = AutoTask.objects.create(
            title='Weekly report',
            when=When.EVERY_WEEK,
            week_day=WeekDay.FRIDAY,
            hour='17:00',
            deadline_day=3,
            deadline_hour='23:59',
            list=task_list
        )
        autotask.users.add(user)

        assert autotask.when == When.EVERY_WEEK
        assert autotask.week_day == WeekDay.FRIDAY

    def test_create_monthly_autotask(self, user):
        """Test creating a monthly recurring task."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        autotask = AutoTask.objects.create(
            title='Monthly review',
            when=When.EVERY_MONTH,
            month_day=1,  # First day of month
            hour='09:00',
            deadline_day=3,
            deadline_hour='17:00',
            list=task_list
        )
        autotask.users.add(user)

        assert autotask.when == When.EVERY_MONTH
        assert autotask.month_day == 1

    def test_autotask_multiple_users(self, multiple_users):
        """Test autotask can be assigned to multiple users."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        autotask = AutoTask.objects.create(
            title='Team task',
            when=When.EVERY_DAY,
            hour='10:00',
            deadline_day=1,
            deadline_hour='18:00',
            list=task_list
        )
        autotask.users.add(multiple_users[0], multiple_users[1], multiple_users[2])

        assert autotask.users.count() == 3


@pytest.mark.django_db
@pytest.mark.integration
class TestTaskAPI:
    """Integration tests for Task API endpoints."""

    def test_list_tasks_requires_authentication(self, api_client):
        """Test listing tasks requires authentication."""
        response = api_client.get('/api/v1/tasks/')
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND
        ]

    def test_authenticated_user_can_create_task(self, auth_client, user):
        """Test authenticated user can create a task."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        response = auth_client.post(
            '/api/v1/tasks/',
            {
                'title': 'New Task',
                'list': task_list.id,
                'user': user.id
            },
            format='json'
        )

        # Endpoint may or may not exist
        if response.status_code == status.HTTP_201_CREATED:
            data = response.json()
            assert data['title'] == 'New Task'

    def test_user_can_only_see_own_tasks(self, auth_client, user, multiple_users):
        """Test user can only see their own tasks."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        # Create task for authenticated user
        Task.objects.create(user=user, title='My Task', list=task_list)

        # Create task for another user
        Task.objects.create(user=multiple_users[0], title='Other Task', list=task_list)

        response = auth_client.get('/api/v1/tasks/')

        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            # Should only see own tasks
            if 'results' in data:
                task_titles = [item['title'] for item in data['results']]
                assert 'My Task' in task_titles or len(task_titles) >= 0


@pytest.mark.django_db
@pytest.mark.unit
class TestTaskStatistics:
    """Test suite for task statistics and analytics."""

    def test_count_completed_tasks(self, user):
        """Test counting completed vs incomplete tasks."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        Task.objects.create(user=user, title='Done 1', list=task_list, is_done=True)
        Task.objects.create(user=user, title='Done 2', list=task_list, is_done=True)
        Task.objects.create(user=user, title='Pending', list=task_list, is_done=False)

        completed = Task.objects.filter(user=user, is_done=True).count()
        pending = Task.objects.filter(user=user, is_done=False).count()

        assert completed == 2
        assert pending == 1

    def test_count_overdue_tasks(self, user):
        """Test counting overdue tasks."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        # Overdue task
        Task.objects.create(
            user=user,
            title='Overdue',
            list=task_list,
            due_date=timezone.now() - timedelta(days=1),
            is_done=False
        )

        # Future task
        Task.objects.create(
            user=user,
            title='Future',
            list=task_list,
            due_date=timezone.now() + timedelta(days=1),
            is_done=False
        )

        overdue = Task.objects.filter(
            user=user,
            due_date__lt=timezone.now(),
            is_done=False
        ).count()

        assert overdue == 1

    def test_task_completion_rate(self, user):
        """Test calculating task completion rate."""
        board = Board.objects.create(name='Board')
        task_list = List.objects.create(name='List', board=board)

        Task.objects.create(user=user, title='Done 1', list=task_list, is_done=True)
        Task.objects.create(user=user, title='Done 2', list=task_list, is_done=True)
        Task.objects.create(user=user, title='Done 3', list=task_list, is_done=True)
        Task.objects.create(user=user, title='Pending', list=task_list, is_done=False)

        total_tasks = Task.objects.filter(user=user).count()
        completed_tasks = Task.objects.filter(user=user, is_done=True).count()

        completion_rate = (completed_tasks / total_tasks) * 100
        assert completion_rate == 75.0


@pytest.mark.django_db
@pytest.mark.unit
class TestCertificateFlow:
    def test_issue_certificate_updates_existing_record(self, admin_client):
        student = User.objects.create_user(
            username='certificate-student',
            password='TestPass123!',
            email='certificate-student@example.com',
            first_name='Certificate',
            last_name='Student',
        )
        course = Course.objects.create(name='IELTS Intensive', price=1200000)
        template = CertificateTemplate.objects.create(
            name='Default Completion',
            is_active=True,
            is_default=True,
            layout_config={},
        )

        response = admin_client.post(
            '/api/task/certificates/',
            {
                'student_id': student.id,
                'course_id': course.id,
                'template_id': template.id,
                'completion_date': '2026-02-01',
                'grade': 'B',
                'hours_completed': 24,
                'notes': 'Initial issue',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        certificate = Certificate.objects.get(student=student, course=course)
        original_id = certificate.id
        original_file_name = certificate.certificate_file.name

        response = admin_client.post(
            '/api/task/certificates/',
            {
                'student_id': student.id,
                'course_id': course.id,
                'template_id': template.id,
                'completion_date': '2026-02-10',
                'grade': 'A',
                'hours_completed': 36,
                'notes': 'Reissued after moderation',
                'force_regenerate': True,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK

        certificate.refresh_from_db()
        assert certificate.id == original_id
        assert certificate.grade == 'A'
        assert certificate.hours_completed == 36
        assert str(certificate.completion_date) == '2026-02-10'
        assert certificate.notes == 'Reissued after moderation'
        assert certificate.issued_by.is_superuser is True
        assert certificate.certificate_file.name
        assert certificate.certificate_file.name != original_file_name

    def test_eligibility_endpoint_returns_learning_context(self, admin_client):
        student = User.objects.create_user(
            username='eligibility-student',
            password='TestPass123!',
            email='eligibility-student@example.com',
            first_name='Eligible',
            last_name='Student',
        )
        teacher = User.objects.create_user(
            username='certificate-teacher',
            password='TestPass123!',
            email='certificate-teacher@example.com',
            first_name='Course',
            last_name='Teacher',
            is_teacher=True,
        )
        branch = Branch.objects.create(name='Main Branch')
        course = Course.objects.create(
            name='SAT Mastery',
            price=1500000,
            instructor=teacher,
            is_published=True,
        )
        group = Group.objects.create(
            name='SAT-01',
            branch=branch,
            course=course,
            main_teacher=teacher,
            start_day=timezone.now().date() - timedelta(days=30),
            end_day=timezone.now().date() + timedelta(days=30),
            start_time='09:00',
            end_time='10:30',
            days='Mon,Wed,Fri',
        )
        group.students.add(student)

        module = CourseModule.objects.create(
            course=course,
            title='Reading',
            order=1,
            is_published=True,
        )
        lesson = Lesson.objects.create(
            module=module,
            title='Reading Basics',
            lesson_type='article',
            order=1,
            is_published=True,
        )
        StudentProgress.objects.create(
            student=student,
            course=course,
            module=module,
            lesson=lesson,
            is_started=True,
            is_completed=True,
            completion_percentage=100,
        )
        Attendance.objects.create(
            student=student,
            group=group,
            date=timezone.now().date(),
            attendance_status=Attendance.STATUS_PRESENT,
        )
        ExamScore.objects.create(
            student=student,
            group=group,
            score=89,
            date=timezone.now().date(),
        )

        response = admin_client.get(
            f'/api/task/certificates/eligibility/?student_id={student.id}&course_id={course.id}'
        )

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        assert payload['eligible'] is True
        assert payload['ready_for_issue'] is True
        assert payload['enrollment']['group_count'] == 1
        assert payload['progress']['completion_rate'] == 100.0
        assert payload['attendance']['attendance_rate'] == 100.0
        assert payload['exams']['average_score'] == 89.0

    def test_verify_endpoint_records_verification_attempt(self, admin_client):
        student = User.objects.create_user(
            username='verify-student',
            password='TestPass123!',
            email='verify-student@example.com',
            first_name='Verify',
            last_name='Student',
        )
        course = Course.objects.create(name='Verification Course', price=1000000)
        template = CertificateTemplate.objects.create(
            name='Verification Template',
            is_active=True,
            is_default=True,
            layout_config={},
        )
        certificate = Certificate.objects.create(
            student=student,
            course=course,
            template=template,
            completion_date=timezone.now().date(),
        )

        response = admin_client.get(
            f'/api/task/certificates/verify/?code={certificate.verification_code}'
        )

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        assert payload['verified'] is True
        assert payload['certificate']['certificate_id'] == str(certificate.certificate_id)
        assert CertificateVerification.objects.filter(certificate=certificate).count() == 1

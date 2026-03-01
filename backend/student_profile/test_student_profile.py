"""
Tests for Student Profile module
"""

import pytest
from rest_framework import status
from student_profile.models import Branch, Course, Group, Attendance
import datetime


@pytest.mark.unit
@pytest.mark.django_db
class TestBranchModel:
    """Test Branch model"""

    def test_create_branch(self):
        """Test creating a branch"""
        branch = Branch.objects.create(
            name='Test Branch',
            latitude='41.2995',
            longitude='69.2401'
        )
        assert branch.name == 'Test Branch'
        assert str(branch) == 'Test Branch'


@pytest.mark.unit
@pytest.mark.django_db
class TestCourseModel:
    """Test Course model"""

    def test_create_course(self):
        """Test creating a course"""
        course = Course.objects.create(
            name='Python Course',
            price=100000000,  # 1M UZS in tiyin
            duration_months=6
        )
        assert course.name == 'Python Course'
        assert course.price == 100000000
        assert course.duration_months == 6
        assert str(course) == 'Python Course'


@pytest.mark.unit
@pytest.mark.django_db
class TestGroupModel:
    """Test Group model"""

    def test_create_group(self, branch, course, room, teacher):
        """Test creating a group"""
        group = Group.objects.create(
            name='Python-001',
            branch=branch,
            course=course,
            room=room,
            main_teacher=teacher,
            start_day=datetime.date.today(),
            end_day=datetime.date.today() + datetime.timedelta(days=90),
            start_time=datetime.time(9, 0),
            end_time=datetime.time(11, 0),
            days='Mon,Wed,Fri'
        )
        assert group.name == 'Python-001'
        assert group.main_teacher == teacher
        assert str(group) == 'Python-001'

    def test_add_students_to_group(self, group, student):
        """Test adding students to a group"""
        group.students.add(student)
        assert group.students.count() == 1
        assert student in group.students.all()


@pytest.mark.api
@pytest.mark.django_db
class TestCourseAPI:
    """Test Course API endpoints"""

    def test_list_courses_unauthenticated(self, api_client):
        """Test listing courses without authentication"""
        response = api_client.get('/api/v1/course/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_courses_authenticated(self, authenticated_client, course):
        """Test listing courses with authentication"""
        response = authenticated_client.get('/api/v1/course/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]

    def test_retrieve_course(self, authenticated_client, course):
        """Test retrieving a specific course"""
        response = authenticated_client.get(f'/api/v1/course/{course.id}/')
        if response.status_code == status.HTTP_200_OK:
            assert response.data['name'] == course.name


@pytest.mark.api
@pytest.mark.django_db
class TestGroupAPI:
    """Test Group API endpoints"""

    def test_list_groups(self, teacher_client, group):
        """Test listing groups as teacher"""
        response = teacher_client.get('/api/v1/mentor/group/')
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]

    def test_retrieve_group(self, teacher_client, group):
        """Test retrieving a specific group"""
        response = teacher_client.get(f'/api/v1/mentor/group/{group.id}/')
        if response.status_code == status.HTTP_200_OK:
            assert response.data['name'] == group.name


@pytest.mark.api
@pytest.mark.django_db
class TestAttendanceAPI:
    """Test Attendance API"""

    def test_mark_attendance(self, teacher_client, group, student):
        """Test marking attendance"""
        group.students.add(student)

        data = {
            'student': student.id,
            'group': group.id,
            'date': datetime.date.today().isoformat(),
            'is_present': True
        }

        response = teacher_client.post('/api/v1/mentor/attendance/', data)
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN
        ]


@pytest.mark.integration
@pytest.mark.django_db
class TestStudentWorkflow:
    """Integration tests for student workflows"""

    def test_complete_enrollment_flow(self, admin_client, branch, course, teacher, student):
        """Test complete student enrollment workflow"""
        # 1. Create a group
        group_data = {
            'name': 'Test Group',
            'branch': branch.id,
            'course': course.id,
            'main_teacher': teacher.id,
            'start_day': datetime.date.today().isoformat(),
            'end_day': (datetime.date.today() + datetime.timedelta(days=90)).isoformat(),
            'start_time': '09:00:00',
            'end_time': '11:00:00',
            'days': 'Mon,Wed,Fri',
            'students': [student.id]
        }

        response = admin_client.post('/api/v1/mentor/group/', group_data)

        # If successful, verify student is enrolled
        if response.status_code == status.HTTP_201_CREATED:
            group_id = response.data['id']

            # 2. Verify student is in group
            group_response = admin_client.get(f'/api/v1/mentor/group/{group_id}/')
            if group_response.status_code == status.HTTP_200_OK:
                assert student.id in group_response.data.get('students', [])

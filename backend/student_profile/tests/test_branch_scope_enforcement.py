from datetime import date, time, timedelta

import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import BranchMembership, UserRoleEnum
from student_profile.models import Attendance, Branch, Course, Group


@pytest.mark.api
@pytest.mark.django_db
class TestBranchScopeEnforcement:
    def _auth_as(self, client, user):
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def _create_group(self, *, branch, course, teacher, name):
        today = date.today()
        return Group.objects.create(
            name=name,
            branch=branch,
            course=course,
            main_teacher=teacher,
            start_day=today,
            end_day=today + timedelta(days=90),
            start_time=time(10, 0),
            end_time=time(11, 0),
            days='monday,wednesday,friday',
        )

    def test_attendance_create_blocks_cross_branch_write(self, api_client, user):
        branch_a = Branch.objects.create(name='Write Scope A')
        branch_b = Branch.objects.create(name='Write Scope B')

        manager = user
        manager.role = UserRoleEnum.MANAGER.value
        manager.branch = branch_a
        manager.save()

        BranchMembership.objects.create(
            user=manager,
            branch=branch_a,
            role=UserRoleEnum.MANAGER.value,
            is_primary=True,
            is_active=True,
        )

        teacher = manager.__class__.objects.create_user(
            username='write_scope_teacher',
            password='StrongPass123!',
            role=UserRoleEnum.TEACHER.value,
            is_teacher=True,
            branch=branch_b,
        )
        student = manager.__class__.objects.create_user(
            username='write_scope_student',
            password='StrongPass123!',
            role=UserRoleEnum.STUDENT.value,
        )

        course = Course.objects.create(name='Physics', description='Physics', price=60000000)
        foreign_group = self._create_group(branch=branch_b, course=course, teacher=teacher, name='Foreign Group')
        foreign_group.students.add(student)

        self._auth_as(api_client, manager)
        response = api_client.post(
            '/api/student-profile/attendance/',
            {
                'student': student.id,
                'group': foreign_group.id,
                'date': str(date.today()),
                'attendance_status': Attendance.STATUS_PRESENT,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Attendance.objects.count() == 0

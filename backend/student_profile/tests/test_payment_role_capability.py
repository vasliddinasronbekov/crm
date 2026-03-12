import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Course, Group, Payment
from users.models import User, UserRoleEnum


def _auth_client_for_user(user: User) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _build_group_with_course(price: int = 8_000_000) -> Group:
    course = Course.objects.create(
        name='Capability Pricing Course',
        price=price,
        duration_months=3,
    )
    return Group.objects.create(
        name='Capability Group',
        course=course,
        start_day='2026-03-01',
        end_day='2026-06-01',
        start_time='09:00',
        end_time='11:00',
        days='Mon,Wed,Fri',
    )


@pytest.mark.django_db
def test_teacher_can_record_payment_via_api():
    teacher = User.objects.create_user(
        username='teacher_payment_record',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_payment_target',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    group = _build_group_with_course()

    client = _auth_client_for_user(teacher)
    response = client.post(
        '/api/v1/payment/',
        {
            'by_user': student.id,
            'group': group.id,
            'status': Payment.PaymentStatus.PENDING,
            'date': '2026-03-11',
            'amount': group.course.price,
            'course_price': group.course.price,
            'pricing_mode': 'course',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    payment = Payment.objects.order_by('-id').first()
    assert payment is not None
    assert payment.by_user_id == student.id
    assert payment.amount == group.course.price


@pytest.mark.django_db
def test_student_cannot_record_payment_via_api():
    student = User.objects.create_user(
        username='student_payment_denied',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    group = _build_group_with_course()

    client = _auth_client_for_user(student)
    response = client.post(
        '/api/v1/payment/',
        {
            'by_user': student.id,
            'group': group.id,
            'status': Payment.PaymentStatus.PENDING,
            'date': '2026-03-11',
            'amount': group.course.price,
            'course_price': group.course.price,
            'pricing_mode': 'course',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_cannot_delete_payment_without_manage_capability():
    teacher = User.objects.create_user(
        username='teacher_payment_delete_denied',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_payment_delete_target',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    group = _build_group_with_course()
    payment = Payment.objects.create(
        by_user=student,
        group=group,
        status=Payment.PaymentStatus.PAID,
        amount=group.course.price,
        course_price=group.course.price,
    )

    client = _auth_client_for_user(teacher)
    response = client.delete(f'/api/v1/payment/{payment.id}/')

    assert response.status_code == status.HTTP_403_FORBIDDEN

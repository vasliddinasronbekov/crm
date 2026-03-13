import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Course, Group, Payment, PaymentAuditLog
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


@pytest.mark.django_db
def test_teacher_payment_list_is_scoped_to_teaching_assignments():
    teacher = User.objects.create_user(
        username='teacher_payment_scope_a',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    other_teacher = User.objects.create_user(
        username='teacher_payment_scope_b',
        password='TestPass123!',
        role=UserRoleEnum.TEACHER.value,
    )
    student = User.objects.create_user(
        username='student_payment_scope',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )

    group_for_teacher = _build_group_with_course()
    group_for_teacher.main_teacher = teacher
    group_for_teacher.save(update_fields=['main_teacher'])

    group_for_other_teacher = _build_group_with_course()
    group_for_other_teacher.main_teacher = other_teacher
    group_for_other_teacher.save(update_fields=['main_teacher'])

    visible_group_payment = Payment.objects.create(
        by_user=student,
        group=group_for_teacher,
        status=Payment.PaymentStatus.PENDING,
        amount=group_for_teacher.course.price,
        course_price=group_for_teacher.course.price,
    )
    visible_direct_teacher_payment = Payment.objects.create(
        by_user=student,
        teacher=teacher,
        status=Payment.PaymentStatus.PENDING,
        amount=5_000_000,
        course_price=5_000_000,
    )
    hidden_other_group_payment = Payment.objects.create(
        by_user=student,
        group=group_for_other_teacher,
        status=Payment.PaymentStatus.PENDING,
        amount=group_for_other_teacher.course.price,
        course_price=group_for_other_teacher.course.price,
    )
    hidden_unscoped_payment = Payment.objects.create(
        by_user=student,
        status=Payment.PaymentStatus.PENDING,
        amount=4_000_000,
        course_price=4_000_000,
    )

    client = _auth_client_for_user(teacher)
    response = client.get('/api/v1/payment/?page_size=100')

    assert response.status_code == status.HTTP_200_OK
    payload = response.data.get('results', response.data)
    returned_ids = {item['id'] for item in payload}

    assert visible_group_payment.id in returned_ids
    assert visible_direct_teacher_payment.id in returned_ids
    assert hidden_other_group_payment.id not in returned_ids
    assert hidden_unscoped_payment.id not in returned_ids


@pytest.mark.django_db
def test_staff_payment_audit_trail_tracks_amount_and_status_changes():
    staff_user = User.objects.create_user(
        username='staff_payment_audit',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    student = User.objects.create_user(
        username='student_payment_audit',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    group = _build_group_with_course(price=10_000_000)

    client = _auth_client_for_user(staff_user)
    create_response = client.post(
        '/api/v1/payment/',
        {
            'by_user': student.id,
            'group': group.id,
            'status': Payment.PaymentStatus.PENDING,
            'date': '2026-03-12',
            'pricing_mode': 'course',
        },
        format='json',
    )
    assert create_response.status_code == status.HTTP_201_CREATED, create_response.data
    payment_id = create_response.data['id']

    update_response = client.patch(
        f'/api/v1/payment/{payment_id}/',
        {
            'status': Payment.PaymentStatus.PAID,
            'amount': 10_250_000,
            'detail': 'Manual adjustment approved by finance',
        },
        format='json',
    )
    assert update_response.status_code == status.HTTP_200_OK, update_response.data

    audit_response = client.get(f'/api/v1/payment/{payment_id}/audit-trail/?limit=20')
    assert audit_response.status_code == status.HTTP_200_OK, audit_response.data

    events = audit_response.data['results']
    assert len(events) >= 2
    assert events[0]['event_type'] == PaymentAuditLog.EVENT_UPDATED
    assert events[0]['status_before'] == Payment.PaymentStatus.PENDING
    assert events[0]['status_after'] == Payment.PaymentStatus.PAID
    assert events[0]['amount_before'] == 10_000_000
    assert events[0]['amount_after'] == 10_250_000
    assert events[1]['event_type'] == PaymentAuditLog.EVENT_CREATED


@pytest.mark.django_db
def test_payment_audit_entries_are_kept_after_payment_delete():
    staff_user = User.objects.create_user(
        username='staff_payment_delete_audit',
        password='TestPass123!',
        role=UserRoleEnum.STAFF.value,
    )
    student = User.objects.create_user(
        username='student_payment_delete_audit',
        password='TestPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    group = _build_group_with_course(price=8_000_000)

    client = _auth_client_for_user(staff_user)
    create_response = client.post(
        '/api/v1/payment/',
        {
            'by_user': student.id,
            'group': group.id,
            'status': Payment.PaymentStatus.PENDING,
            'date': '2026-03-12',
            'pricing_mode': 'course',
        },
        format='json',
    )
    assert create_response.status_code == status.HTTP_201_CREATED, create_response.data
    payment_id = create_response.data['id']

    delete_response = client.delete(f'/api/v1/payment/{payment_id}/')
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    logs = PaymentAuditLog.objects.filter(payment_id_snapshot=payment_id).order_by('-created_at', '-id')
    assert logs.filter(event_type=PaymentAuditLog.EVENT_DELETED).exists()
    assert logs.exists()
    assert logs.first().payment_id_snapshot == payment_id

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from student_profile.models import Branch
from users.models import BranchMembership, User, UserRoleEnum

from .models import Invoice, Payment, SubscriptionPlan, UserSubscription


def _auth_client_for_user(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.mark.django_db
def test_subscription_read_endpoints_are_branch_scoped_for_staff(api_client):
    branch_a = Branch.objects.create(name='Subscription Scope Branch A')
    branch_b = Branch.objects.create(name='Subscription Scope Branch B')

    manager = User.objects.create_user(
        username='subscription_scope_manager',
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

    student_a = User.objects.create_user(
        username='subscription_scope_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    student_b = User.objects.create_user(
        username='subscription_scope_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    plan = SubscriptionPlan.objects.create(
        name='Scoped Plan',
        slug='scoped-plan',
        description='Scoped',
        price=Decimal('100.00'),
        currency='USD',
        interval='monthly',
        is_active=True,
    )

    now = timezone.now()
    sub_a = UserSubscription.objects.create(
        user=student_a,
        plan=plan,
        status='active',
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    sub_b = UserSubscription.objects.create(
        user=student_b,
        plan=plan,
        status='active',
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )

    payment_a = Payment.objects.create(
        user=student_a,
        subscription=sub_a,
        amount=Decimal('100.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )
    payment_b = Payment.objects.create(
        user=student_b,
        subscription=sub_b,
        amount=Decimal('300.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )

    invoice_a = Invoice.objects.create(
        user=student_a,
        subscription=sub_a,
        payment=payment_a,
        invoice_number='SCOPE-A-0001',
        status='paid',
        subtotal=Decimal('100.00'),
        tax=Decimal('0'),
        discount=Decimal('0'),
        total=Decimal('100.00'),
        currency='USD',
        line_items=[{'description': 'Scoped A', 'amount': 100}],
        due_date=now.date() + timedelta(days=7),
    )
    invoice_b = Invoice.objects.create(
        user=student_b,
        subscription=sub_b,
        payment=payment_b,
        invoice_number='SCOPE-B-0001',
        status='paid',
        subtotal=Decimal('300.00'),
        tax=Decimal('0'),
        discount=Decimal('0'),
        total=Decimal('300.00'),
        currency='USD',
        line_items=[{'description': 'Scoped B', 'amount': 300}],
        due_date=now.date() + timedelta(days=7),
    )

    client = _auth_client_for_user(api_client, manager)

    subs_response = client.get('/api/subscriptions/subscriptions/')
    assert subs_response.status_code == status.HTTP_200_OK
    subs_payload = subs_response.data['results'] if isinstance(subs_response.data, dict) else subs_response.data
    sub_ids = {item['id'] for item in subs_payload}
    assert sub_a.id in sub_ids
    assert sub_b.id not in sub_ids

    payments_response = client.get('/api/subscriptions/payments/')
    assert payments_response.status_code == status.HTTP_200_OK
    payments_payload = payments_response.data['results'] if isinstance(payments_response.data, dict) else payments_response.data
    payment_ids = {item['id'] for item in payments_payload}
    assert payment_a.id in payment_ids
    assert payment_b.id not in payment_ids

    invoices_response = client.get('/api/subscriptions/invoices/')
    assert invoices_response.status_code == status.HTTP_200_OK
    invoices_payload = invoices_response.data['results'] if isinstance(invoices_response.data, dict) else invoices_response.data
    invoice_ids = {item['id'] for item in invoices_payload}
    assert invoice_a.id in invoice_ids
    assert invoice_b.id not in invoice_ids


@pytest.mark.django_db
def test_subscription_stats_are_branch_scoped_for_staff(api_client):
    branch_a = Branch.objects.create(name='Subscription Stats Branch A')
    branch_b = Branch.objects.create(name='Subscription Stats Branch B')

    manager = User.objects.create_user(
        username='subscription_stats_scope_manager',
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

    student_a = User.objects.create_user(
        username='subscription_stats_scope_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    student_b = User.objects.create_user(
        username='subscription_stats_scope_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    plan = SubscriptionPlan.objects.create(
        name='Scoped Stats Plan',
        slug='scoped-stats-plan',
        description='Scoped stats',
        price=Decimal('100.00'),
        currency='USD',
        interval='monthly',
        is_active=True,
    )

    now = timezone.now()
    UserSubscription.objects.create(
        user=student_a,
        plan=plan,
        status='active',
        created_at=now,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    UserSubscription.objects.create(
        user=student_b,
        plan=plan,
        status='active',
        created_at=now,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )

    Payment.objects.create(
        user=student_a,
        amount=Decimal('120.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )
    Payment.objects.create(
        user=student_b,
        amount=Decimal('250.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )
    Payment.objects.create(
        user=student_b,
        amount=Decimal('75.00'),
        currency='USD',
        payment_method='payme',
        status='failed',
    )

    client = _auth_client_for_user(api_client, manager)

    overview_response = client.get('/api/subscriptions/stats/overview/')
    assert overview_response.status_code == status.HTTP_200_OK
    assert overview_response.data['total_active_subscriptions'] == 1
    assert str(overview_response.data['total_revenue']) in {'120.00', '120'}
    assert overview_response.data['total_customers'] == 1

    revenue_response = client.get('/api/subscriptions/stats/revenue/')
    assert revenue_response.status_code == status.HTTP_200_OK
    assert str(revenue_response.data['total_revenue']) in {'120.00', '120'}
    assert revenue_response.data['successful_payments'] == 1
    assert revenue_response.data['failed_payments'] == 0


@pytest.mark.django_db
def test_subscription_read_endpoints_exclude_legacy_cross_branch_links(api_client):
    branch_a = Branch.objects.create(name='Subscription Legacy Branch A')
    branch_b = Branch.objects.create(name='Subscription Legacy Branch B')

    manager = User.objects.create_user(
        username='subscription_legacy_scope_manager',
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

    student_a = User.objects.create_user(
        username='subscription_legacy_scope_student_a',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_a,
    )
    student_b = User.objects.create_user(
        username='subscription_legacy_scope_student_b',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
        branch=branch_b,
    )

    plan = SubscriptionPlan.objects.create(
        name='Scoped Legacy Plan',
        slug='scoped-legacy-plan',
        description='Scoped legacy',
        price=Decimal('100.00'),
        currency='USD',
        interval='monthly',
        is_active=True,
    )

    now = timezone.now()
    sub_a = UserSubscription.objects.create(
        user=student_a,
        plan=plan,
        status='active',
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    sub_b = UserSubscription.objects.create(
        user=student_b,
        plan=plan,
        status='active',
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )

    in_scope_payment = Payment.objects.create(
        user=student_a,
        subscription=sub_a,
        amount=Decimal('100.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )
    legacy_cross_branch_payment = Payment.objects.create(
        user=student_a,
        subscription=sub_b,
        amount=Decimal('50.00'),
        currency='USD',
        payment_method='payme',
        status='succeeded',
        succeeded_at=now,
    )

    in_scope_invoice = Invoice.objects.create(
        user=student_a,
        subscription=sub_a,
        payment=in_scope_payment,
        invoice_number='SCOPE-LEGACY-A-0001',
        status='paid',
        subtotal=Decimal('100.00'),
        tax=Decimal('0'),
        discount=Decimal('0'),
        total=Decimal('100.00'),
        currency='USD',
        line_items=[{'description': 'Scoped In', 'amount': 100}],
        due_date=now.date() + timedelta(days=7),
    )
    legacy_cross_branch_invoice = Invoice.objects.create(
        user=student_a,
        subscription=sub_b,
        payment=legacy_cross_branch_payment,
        invoice_number='SCOPE-LEGACY-A-0002',
        status='paid',
        subtotal=Decimal('50.00'),
        tax=Decimal('0'),
        discount=Decimal('0'),
        total=Decimal('50.00'),
        currency='USD',
        line_items=[{'description': 'Scoped Legacy', 'amount': 50}],
        due_date=now.date() + timedelta(days=7),
    )

    client = _auth_client_for_user(api_client, manager)

    payments_response = client.get('/api/subscriptions/payments/')
    assert payments_response.status_code == status.HTTP_200_OK
    payments_payload = payments_response.data['results'] if isinstance(payments_response.data, dict) else payments_response.data
    payment_ids = {item['id'] for item in payments_payload}
    assert in_scope_payment.id in payment_ids
    assert legacy_cross_branch_payment.id not in payment_ids

    invoices_response = client.get('/api/subscriptions/invoices/')
    assert invoices_response.status_code == status.HTTP_200_OK
    invoices_payload = invoices_response.data['results'] if isinstance(invoices_response.data, dict) else invoices_response.data
    invoice_ids = {item['id'] for item in invoices_payload}
    assert in_scope_invoice.id in invoice_ids
    assert legacy_cross_branch_invoice.id not in invoice_ids

    revenue_response = client.get('/api/subscriptions/stats/revenue/')
    assert revenue_response.status_code == status.HTTP_200_OK
    assert str(revenue_response.data['total_revenue']) in {'100.00', '100'}
    assert revenue_response.data['successful_payments'] == 1

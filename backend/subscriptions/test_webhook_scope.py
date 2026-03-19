import hashlib
from decimal import Decimal
from django.utils import timezone

import pytest
from rest_framework import status

from users.models import User, UserRoleEnum

from .models import Payment
from .payment_services import ClickService


@pytest.mark.django_db
def test_payme_webhook_rejects_non_payme_order(api_client):
    user = User.objects.create_user(
        username='webhook_scope_user_payme',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    click_payment = Payment.objects.create(
        user=user,
        amount=Decimal('100.00'),
        currency='UZS',
        payment_method='click',
        status='pending',
    )

    response = api_client.post(
        '/api/subscriptions/webhooks/payme/',
        {
            'method': 'CheckPerformTransaction',
            'params': {
                'account': {'order_id': click_payment.id},
                'amount': int(click_payment.amount * 100),
            },
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['error']['code'] == -31050


@pytest.mark.django_db
def test_click_webhook_rejects_non_click_order(api_client, monkeypatch):
    monkeypatch.setattr(ClickService, 'SECRET_KEY', 'scope-secret')

    user = User.objects.create_user(
        username='webhook_scope_user_click',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    payme_payment = Payment.objects.create(
        user=user,
        amount=Decimal('120.00'),
        currency='UZS',
        payment_method='payme',
        status='pending',
    )

    click_trans_id = 'scope-click-001'
    sign_string = hashlib.md5(f'{click_trans_id}{ClickService.SECRET_KEY}'.encode()).hexdigest()

    response = api_client.post(
        '/api/subscriptions/webhooks/click/',
        {
            'click_trans_id': click_trans_id,
            'merchant_trans_id': str(payme_payment.id),
            'amount': str(payme_payment.amount),
            'action': '0',
            'sign_string': sign_string,
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['error'] == -5


@pytest.mark.django_db
def test_payme_create_transaction_rejects_amount_mismatch(api_client):
    user = User.objects.create_user(
        username='webhook_scope_user_payme_amount',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    payme_payment = Payment.objects.create(
        user=user,
        amount=Decimal('100.00'),
        currency='UZS',
        payment_method='payme',
        status='pending',
    )

    response = api_client.post(
        '/api/subscriptions/webhooks/payme/',
        {
            'method': 'CreateTransaction',
            'params': {
                'id': 'payme-tx-amount-check',
                'account': {'order_id': payme_payment.id},
                'amount': int(payme_payment.amount * 100) + 1,
            },
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['error']['code'] == -31001


@pytest.mark.django_db
def test_payme_perform_transaction_is_idempotent(api_client):
    user = User.objects.create_user(
        username='webhook_scope_user_payme_idempotent',
        password='StrongPass123!',
        role=UserRoleEnum.STUDENT.value,
    )
    payment = Payment.objects.create(
        user=user,
        amount=Decimal('100.00'),
        currency='UZS',
        payment_method='payme',
        status='succeeded',
        payme_transaction_id='payme-idempotent-001',
        succeeded_at=timezone.now(),
    )

    response = api_client.post(
        '/api/subscriptions/webhooks/payme/',
        {
            'method': 'PerformTransaction',
            'params': {'id': payment.payme_transaction_id},
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['result']['state'] == 2

    payment.refresh_from_db()
    assert payment.status == 'succeeded'

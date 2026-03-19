"""
Payment Gateway Webhook Handlers

Handles webhook events from Stripe, Payme, and Click
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .models import Payment, UserSubscription
from .payment_services import StripeService, PaymeService, ClickService

logger = logging.getLogger(__name__)


def _parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_tiyin(amount: Decimal) -> int:
    return int((amount * Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


# ==================== Stripe Webhooks ====================

@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Handle Stripe webhook events

    Documentation: https://stripe.com/docs/webhooks

    Common events:
    - payment_intent.succeeded
    - payment_intent.payment_failed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    # Verify webhook signature
    success, event = StripeService.verify_webhook(payload, sig_header)

    if not success:
        logger.error("Stripe webhook signature verification failed")
        return Response({'error': 'Invalid signature'}, status=400)

    event_type = event.get('type')
    logger.info(f"Stripe webhook received: {event_type}")

    try:
        # Handle payment_intent.succeeded
        if event_type == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            payment_intent_id = payment_intent['id']

            # Find and update payment
            payment = Payment.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                payment_method__in=['stripe_card', 'stripe_bank'],
            ).first()

            if payment:
                payment.status = 'succeeded'
                payment.succeeded_at = timezone.now()
                payment.receipt_url = payment_intent.get('charges', {}).get('data', [{}])[0].get('receipt_url', '')
                payment.save()
                logger.info(f"Payment {payment.id} marked as succeeded")
            else:
                logger.warning(f"Payment with intent {payment_intent_id} not found")

        # Handle payment_intent.payment_failed
        elif event_type == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            payment_intent_id = payment_intent['id']

            payment = Payment.objects.filter(
                stripe_payment_intent_id=payment_intent_id,
                payment_method__in=['stripe_card', 'stripe_bank'],
            ).first()

            if payment:
                payment.status = 'failed'
                payment.failure_reason = payment_intent.get('last_payment_error', {}).get('message', 'Payment failed')
                payment.save()
                logger.info(f"Payment {payment.id} marked as failed")

        # Handle subscription events
        elif event_type == 'customer.subscription.created':
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']

            # Update UserSubscription
            user_sub = UserSubscription.objects.filter(
                stripe_subscription_id=stripe_subscription_id
            ).first()

            if user_sub:
                user_sub.status = 'active' if subscription['status'] == 'active' else 'trialing'
                user_sub.save()
                logger.info(f"Subscription {user_sub.id} created/updated")

        elif event_type == 'customer.subscription.updated':
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']

            user_sub = UserSubscription.objects.filter(
                stripe_subscription_id=stripe_subscription_id
            ).first()

            if user_sub:
                # Update subscription status
                status_map = {
                    'active': 'active',
                    'trialing': 'trialing',
                    'past_due': 'past_due',
                    'canceled': 'canceled',
                    'unpaid': 'past_due'
                }
                user_sub.status = status_map.get(subscription['status'], 'active')
                user_sub.save()
                logger.info(f"Subscription {user_sub.id} updated")

        elif event_type == 'customer.subscription.deleted':
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']

            user_sub = UserSubscription.objects.filter(
                stripe_subscription_id=stripe_subscription_id
            ).first()

            if user_sub:
                user_sub.status = 'canceled'
                user_sub.canceled_at = timezone.now()
                user_sub.save()
                logger.info(f"Subscription {user_sub.id} canceled")

        return Response({'received': True}, status=200)

    except Exception as e:
        logger.error(f"Error processing Stripe webhook: {e}", exc_info=True)
        return Response({'error': str(e)}, status=500)


# ==================== Payme Webhooks ====================

@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def payme_webhook(request):
    """
    Handle Payme webhook events

    Documentation: https://developer.help.paycom.uz/

    Payme uses JSON-RPC 2.0 protocol
    Methods:
    - CheckPerformTransaction
    - CreateTransaction
    - PerformTransaction
    - CancelTransaction
    - CheckTransaction
    - GetStatement
    """
    try:
        data = json.loads(request.body.decode('utf-8'))
        method = data.get('method')
        params = data.get('params', {})

        logger.info(f"Payme webhook received: {method}")

        # CheckPerformTransaction
        if method == 'CheckPerformTransaction':
            order_id = _parse_int(params.get('account', {}).get('order_id'))
            amount = _parse_int(params.get('amount'))
            if order_id is None:
                return Response({
                    'error': {
                        'code': -31050,
                        'message': 'Order not found'
                    }
                }, status=200)

            # Validate order exists and amount matches
            payment = Payment.objects.filter(id=order_id, payment_method='payme').first()

            if not payment:
                return Response({
                    'error': {
                        'code': -31050,
                        'message': 'Order not found'
                    }
                }, status=200)

            # Amount validation (Payme sends in tiyin)
            expected_amount = _to_tiyin(payment.amount)
            if amount is None or amount != expected_amount:
                return Response({
                    'error': {
                        'code': -31001,
                        'message': 'Invalid amount'
                    }
                }, status=200)

            return Response({
                'result': {
                    'allow': True
                }
            }, status=200)

        # CreateTransaction
        elif method == 'CreateTransaction':
            transaction_id = params.get('id')
            order_id = _parse_int(params.get('account', {}).get('order_id'))
            amount = _parse_int(params.get('amount'))
            if order_id is None:
                return Response({
                    'error': {
                        'code': -31050,
                        'message': 'Order not found'
                    }
                }, status=200)

            payment = Payment.objects.filter(id=order_id, payment_method='payme').first()

            if not payment:
                return Response({
                    'error': {
                        'code': -31050,
                        'message': 'Order not found'
                    }
                }, status=200)

            expected_amount = _to_tiyin(payment.amount)
            if amount is None or amount != expected_amount:
                return Response({
                    'error': {
                        'code': -31001,
                        'message': 'Invalid amount'
                    }
                }, status=200)

            if payment.status == 'succeeded':
                return Response({
                    'result': {
                        'create_time': int(payment.created_at.timestamp() * 1000),
                        'transaction': str(payment.payme_transaction_id or transaction_id),
                        'state': 2
                    }
                }, status=200)

            if payment.status == 'canceled':
                return Response({
                    'result': {
                        'create_time': int(payment.created_at.timestamp() * 1000),
                        'transaction': str(payment.payme_transaction_id or transaction_id),
                        'state': -1
                    }
                }, status=200)

            # Update payment with transaction ID
            payment.payme_transaction_id = transaction_id
            payment.status = 'processing'
            payment.save()

            return Response({
                'result': {
                    'create_time': int(payment.created_at.timestamp() * 1000),
                    'transaction': str(transaction_id),
                    'state': 1
                }
            }, status=200)

        # PerformTransaction
        elif method == 'PerformTransaction':
            transaction_id = params.get('id')

            payment = Payment.objects.filter(
                payme_transaction_id=transaction_id,
                payment_method='payme',
            ).first()

            if not payment:
                return Response({
                    'error': {
                        'code': -31003,
                        'message': 'Transaction not found'
                    }
                }, status=200)

            if payment.status == 'succeeded':
                return Response({
                    'result': {
                        'transaction': str(transaction_id),
                        'perform_time': int((payment.succeeded_at or timezone.now()).timestamp() * 1000),
                        'state': 2
                    }
                }, status=200)

            if payment.status == 'canceled':
                return Response({
                    'error': {
                        'code': -31008,
                        'message': 'Transaction canceled'
                    }
                }, status=200)

            payment.status = 'succeeded'
            payment.succeeded_at = timezone.now()
            payment.save()

            return Response({
                'result': {
                    'transaction': str(transaction_id),
                    'perform_time': int(timezone.now().timestamp() * 1000),
                    'state': 2
                }
            }, status=200)

        # CancelTransaction
        elif method == 'CancelTransaction':
            transaction_id = params.get('id')
            reason = params.get('reason')

            payment = Payment.objects.filter(
                payme_transaction_id=transaction_id,
                payment_method='payme',
            ).first()

            if not payment:
                return Response({
                    'error': {
                        'code': -31003,
                        'message': 'Transaction not found'
                    }
                }, status=200)

            if payment.status == 'canceled':
                return Response({
                    'result': {
                        'transaction': str(transaction_id),
                        'cancel_time': int(payment.updated_at.timestamp() * 1000),
                        'state': -1
                    }
                }, status=200)

            payment.status = 'canceled'
            payment.failure_reason = f"Canceled: {reason}"
            payment.save()

            return Response({
                'result': {
                    'transaction': str(transaction_id),
                    'cancel_time': int(timezone.now().timestamp() * 1000),
                    'state': -1
                }
            }, status=200)

        # CheckTransaction
        elif method == 'CheckTransaction':
            transaction_id = params.get('id')

            payment = Payment.objects.filter(
                payme_transaction_id=transaction_id,
                payment_method='payme',
            ).first()

            if not payment:
                return Response({
                    'error': {
                        'code': -31003,
                        'message': 'Transaction not found'
                    }
                }, status=200)

            state_map = {
                'pending': 0,
                'processing': 1,
                'succeeded': 2,
                'canceled': -1,
                'failed': -2
            }

            return Response({
                'result': {
                    'create_time': int(payment.created_at.timestamp() * 1000),
                    'perform_time': int(payment.succeeded_at.timestamp() * 1000) if payment.succeeded_at else 0,
                    'transaction': str(transaction_id),
                    'state': state_map.get(payment.status, 0),
                    'reason': payment.failure_reason or None
                }
            }, status=200)

        return Response({
            'error': {
                'code': -32601,
                'message': 'Method not found'
            }
        }, status=200)

    except Exception as e:
        logger.error(f"Error processing Payme webhook: {e}", exc_info=True)
        return Response({
            'error': {
                'code': -32700,
                'message': 'Parse error'
            }
        }, status=200)


# ==================== Click Webhooks ====================

@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def click_webhook(request):
    """
    Handle Click webhook events

    Documentation: https://docs.click.uz/

    Two endpoints:
    - prepare: Validate transaction before payment
    - complete: Complete transaction after payment
    """
    try:
        # Click sends data as form-encoded or JSON
        if request.content_type == 'application/json':
            data = json.loads(request.body.decode('utf-8'))
        else:
            data = request.POST.dict()

        click_trans_id = data.get('click_trans_id')
        service_id = data.get('service_id')
        merchant_trans_id = _parse_int(data.get('merchant_trans_id'))  # Our payment ID
        amount = data.get('amount')
        action = data.get('action')  # 0 = prepare, 1 = complete
        sign_string = data.get('sign_string')

        logger.info(f"Click webhook received: action={action}")

        # Verify signature
        success, result = ClickService.verify_transaction(click_trans_id, sign_string)

        if not success:
            return Response({
                'error': -1,
                'error_note': 'Invalid signature'
            }, status=200)

        # Prepare transaction (action = 0)
        if str(action) == '0':
            if merchant_trans_id is None:
                return Response({
                    'error': -5,
                    'error_note': 'Order not found'
                }, status=200)
            payment = Payment.objects.filter(id=merchant_trans_id, payment_method='click').first()

            if not payment:
                return Response({
                    'error': -5,
                    'error_note': 'Order not found'
                }, status=200)

            # Validate amount
            parsed_amount = _parse_decimal(amount)
            if parsed_amount is None or parsed_amount != payment.amount:
                return Response({
                    'error': -2,
                    'error_note': 'Invalid amount'
                }, status=200)

            # Already paid
            if payment.status == 'succeeded':
                return Response({
                    'error': -4,
                    'error_note': 'Already paid'
                }, status=200)

            return Response({
                'error': 0,
                'error_note': 'Success',
                'click_trans_id': click_trans_id,
                'merchant_trans_id': merchant_trans_id,
                'merchant_prepare_id': payment.id
            }, status=200)

        # Complete transaction (action = 1)
        elif str(action) == '1':
            if merchant_trans_id is None:
                return Response({
                    'error': -5,
                    'error_note': 'Order not found'
                }, status=200)
            payment = Payment.objects.filter(id=merchant_trans_id, payment_method='click').first()

            if not payment:
                return Response({
                    'error': -5,
                    'error_note': 'Order not found'
                }, status=200)

            # Validate amount
            parsed_amount = _parse_decimal(amount)
            if parsed_amount is None or parsed_amount != payment.amount:
                return Response({
                    'error': -2,
                    'error_note': 'Invalid amount'
                }, status=200)

            # Already paid
            if payment.status == 'succeeded':
                return Response({
                    'error': -4,
                    'error_note': 'Already paid',
                    'click_trans_id': click_trans_id,
                    'merchant_trans_id': merchant_trans_id,
                    'merchant_confirm_id': payment.id
                }, status=200)

            # Update payment
            payment.click_transaction_id = click_trans_id
            payment.status = 'succeeded'
            payment.succeeded_at = timezone.now()
            payment.save()

            return Response({
                'error': 0,
                'error_note': 'Success',
                'click_trans_id': click_trans_id,
                'merchant_trans_id': merchant_trans_id,
                'merchant_confirm_id': payment.id
            }, status=200)

        return Response({
            'error': -8,
            'error_note': 'Invalid action'
        }, status=200)

    except Exception as e:
        logger.error(f"Error processing Click webhook: {e}", exc_info=True)
        return Response({
            'error': -9,
            'error_note': 'System error'
        }, status=200)

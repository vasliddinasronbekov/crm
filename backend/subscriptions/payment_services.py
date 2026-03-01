"""
Payment Gateway Integration Services

Stripe, Payme, and Click payment integrations
"""
import os
from decimal import Decimal
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

# ==================== Stripe Integration ====================

try:
    import stripe
    stripe.api_key = os.getenv('STRIPE_SECRET_KEY', '')
    STRIPE_AVAILABLE = bool(stripe.api_key)
except ImportError:
    STRIPE_AVAILABLE = False
    logger.warning("Stripe not installed. Install with: pip install stripe")


class StripeService:
    """Stripe payment processing service"""

    @staticmethod
    def create_customer(user) -> Tuple[bool, str]:
        """Create Stripe customer"""
        if not STRIPE_AVAILABLE:
            return False, "Stripe not configured"

        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.get_full_name(),
                metadata={'user_id': user.id}
            )
            return True, customer.id
        except Exception as e:
            logger.error(f"Stripe customer creation failed: {e}")
            return False, str(e)

    @staticmethod
    def create_subscription(customer_id: str, price_id: str) -> Tuple[bool, Dict]:
        """Create Stripe subscription"""
        if not STRIPE_AVAILABLE:
            return False, {"error": "Stripe not configured"}

        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_id}],
                payment_behavior='default_incomplete',
                expand=['latest_invoice.payment_intent']
            )
            return True, {
                'subscription_id': subscription.id,
                'client_secret': subscription.latest_invoice.payment_intent.client_secret
            }
        except Exception as e:
            logger.error(f"Stripe subscription creation failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def cancel_subscription(subscription_id: str, immediate: bool = False) -> Tuple[bool, str]:
        """Cancel Stripe subscription"""
        if not STRIPE_AVAILABLE:
            return False, "Stripe not configured"

        try:
            if immediate:
                stripe.Subscription.delete(subscription_id)
            else:
                stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            return True, "Subscription canceled"
        except Exception as e:
            logger.error(f"Stripe cancellation failed: {e}")
            return False, str(e)

    @staticmethod
    def create_payment_intent(amount: Decimal, currency: str = 'usd') -> Tuple[bool, Dict]:
        """Create Stripe payment intent"""
        if not STRIPE_AVAILABLE:
            return False, {"error": "Stripe not configured"}

        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to cents
                currency=currency.lower(),
            )
            return True, {
                'payment_intent_id': intent.id,
                'client_secret': intent.client_secret
            }
        except Exception as e:
            logger.error(f"Stripe payment intent failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def verify_webhook(payload: bytes, sig_header: str) -> Tuple[bool, Dict]:
        """Verify Stripe webhook signature"""
        if not STRIPE_AVAILABLE:
            return False, {}

        webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET', '')
        if not webhook_secret:
            return False, {}

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            return True, event
        except Exception as e:
            logger.error(f"Stripe webhook verification failed: {e}")
            return False, {}


# ==================== Payme Integration ====================

class PaymeService:
    """
    Payme (Uzbekistan) payment integration

    Documentation: https://developer.help.paycom.uz/
    """

    PAYME_URL = "https://checkout.paycom.uz"
    MERCHANT_ID = os.getenv('PAYME_MERCHANT_ID', '')

    @staticmethod
    def create_payment(amount: Decimal, order_id: int, return_url: str) -> Dict:
        """Generate Payme payment URL"""
        if not PaymeService.MERCHANT_ID:
            return {'error': 'Payme not configured'}

        # Convert amount to tiyin (1 UZS = 100 tiyin)
        amount_tiyin = int(amount * 100)

        # Base64 encode the params
        import base64
        import json

        params = {
            'm': PaymeService.MERCHANT_ID,
            'ac.order_id': order_id,
            'a': amount_tiyin,
            'c': return_url
        }

        params_str = json.dumps(params)
        params_b64 = base64.b64encode(params_str.encode()).decode()

        payment_url = f"{PaymeService.PAYME_URL}/{params_b64}"

        return {
            'payment_url': payment_url,
            'params': params
        }

    @staticmethod
    def verify_transaction(transaction_id: str) -> Tuple[bool, Dict]:
        """Verify Payme transaction status"""
        # Implementation depends on Payme API
        # You need to implement the Merchant API methods
        logger.info(f"Verifying Payme transaction: {transaction_id}")
        return True, {'status': 'pending'}


# ==================== Click Integration ====================

class ClickService:
    """
    Click (Uzbekistan) payment integration

    Documentation: https://docs.click.uz/
    """

    CLICK_URL = "https://my.click.uz/services/pay"
    MERCHANT_ID = os.getenv('CLICK_MERCHANT_ID', '')
    SERVICE_ID = os.getenv('CLICK_SERVICE_ID', '')
    SECRET_KEY = os.getenv('CLICK_SECRET_KEY', '')

    @staticmethod
    def create_payment(amount: Decimal, order_id: int, return_url: str) -> Dict:
        """Generate Click payment URL"""
        if not ClickService.MERCHANT_ID or not ClickService.SERVICE_ID:
            return {'error': 'Click not configured'}

        payment_url = (
            f"{ClickService.CLICK_URL}"
            f"?service_id={ClickService.SERVICE_ID}"
            f"&merchant_id={ClickService.MERCHANT_ID}"
            f"&amount={amount}"
            f"&transaction_param={order_id}"
            f"&return_url={return_url}"
        )

        return {
            'payment_url': payment_url,
            'merchant_id': ClickService.MERCHANT_ID,
            'service_id': ClickService.SERVICE_ID
        }

    @staticmethod
    def verify_transaction(click_trans_id: str, sign_string: str) -> Tuple[bool, Dict]:
        """Verify Click transaction"""
        import hashlib

        if not ClickService.SECRET_KEY:
            return False, {'error': 'Click secret key not configured'}

        # Verify signature
        expected_sign = hashlib.md5(
            f"{click_trans_id}{ClickService.SECRET_KEY}".encode()
        ).hexdigest()

        if expected_sign != sign_string:
            return False, {'error': 'Invalid signature'}

        return True, {'status': 'verified'}


# ==================== Payment Service Factory ====================

class PaymentService:
    """
    Unified payment service interface

    Handles routing to appropriate payment gateway
    """

    @staticmethod
    def process_payment(payment_method: str, amount: Decimal, currency: str, **kwargs) -> Tuple[bool, Dict]:
        """
        Process payment through appropriate gateway

        Args:
            payment_method: 'stripe_card', 'payme', 'click', etc.
            amount: Payment amount
            currency: Currency code
            **kwargs: Additional parameters

        Returns:
            (success, response_data)
        """

        if payment_method == 'stripe_card':
            return StripeService.create_payment_intent(amount, currency)

        elif payment_method == 'paypal':
            return PayPalService.create_payment(
                amount=amount,
                currency=currency,
                return_url=kwargs.get('return_url', ''),
                cancel_url=kwargs.get('cancel_url', ''),
                description=kwargs.get('description', '')
            )

        elif payment_method == 'payme':
            return True, PaymeService.create_payment(
                amount=amount,
                order_id=kwargs.get('order_id'),
                return_url=kwargs.get('return_url', '')
            )

        elif payment_method == 'click':
            return True, ClickService.create_payment(
                amount=amount,
                order_id=kwargs.get('order_id'),
                return_url=kwargs.get('return_url', '')
            )

        elif payment_method == 'yandex':
            return YandexKassaService.create_payment(
                amount=amount,
                currency=currency,
                return_url=kwargs.get('return_url', ''),
                description=kwargs.get('description', '')
            )

        elif payment_method == 'alipay':
            return AlipayWeChatService.create_alipay_payment(
                amount=amount,
                order_id=kwargs.get('order_id'),
                return_url=kwargs.get('return_url', '')
            )

        elif payment_method == 'wechat':
            return AlipayWeChatService.create_wechat_payment(
                amount=amount,
                order_id=kwargs.get('order_id'),
                description=kwargs.get('description', '')
            )

        else:
            return False, {'error': f'Unsupported payment method: {payment_method}'}

    @staticmethod
    def verify_payment(payment_method: str, **kwargs) -> Tuple[bool, Dict]:
        """Verify payment status"""

        if payment_method == 'paypal':
            return PayPalService.execute_payment(
                kwargs.get('payment_id'),
                kwargs.get('payer_id')
            )

        elif payment_method == 'payme':
            return PaymeService.verify_transaction(kwargs.get('transaction_id'))

        elif payment_method == 'click':
            return ClickService.verify_transaction(
                kwargs.get('click_trans_id'),
                kwargs.get('sign_string')
            )

        elif payment_method == 'yandex':
            return YandexKassaService.verify_payment(kwargs.get('payment_id'))

        return False, {'error': 'Verification not implemented'}


# ==================== PayPal Integration ====================

try:
    from paypalrestsdk import Payment as PayPalPayment
    import paypalrestsdk

    paypalrestsdk.configure({
        "mode": os.getenv('PAYPAL_MODE', 'sandbox'),  # sandbox or live
        "client_id": os.getenv('PAYPAL_CLIENT_ID', ''),
        "client_secret": os.getenv('PAYPAL_CLIENT_SECRET', '')
    })
    PAYPAL_AVAILABLE = bool(os.getenv('PAYPAL_CLIENT_ID'))
except ImportError:
    PAYPAL_AVAILABLE = False
    logger.warning("PayPal SDK not installed. Install with: pip install paypalrestsdk")


class PayPalService:
    """PayPal payment processing service"""

    @staticmethod
    def create_payment(amount: Decimal, currency: str, return_url: str, cancel_url: str, description: str = "") -> Tuple[bool, Dict]:
        """Create PayPal payment"""
        if not PAYPAL_AVAILABLE:
            return False, {"error": "PayPal not configured"}

        try:
            payment = PayPalPayment({
                "intent": "sale",
                "payer": {"payment_method": "paypal"},
                "redirect_urls": {
                    "return_url": return_url,
                    "cancel_url": cancel_url
                },
                "transactions": [{
                    "amount": {
                        "total": str(amount),
                        "currency": currency.upper()
                    },
                    "description": description
                }]
            })

            if payment.create():
                # Get approval URL
                for link in payment.links:
                    if link.rel == "approval_url":
                        return True, {
                            'payment_id': payment.id,
                            'approval_url': link.href
                        }

            logger.error(f"PayPal payment creation failed: {payment.error}")
            return False, {"error": payment.error}

        except Exception as e:
            logger.error(f"PayPal payment failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def execute_payment(payment_id: str, payer_id: str) -> Tuple[bool, Dict]:
        """Execute approved PayPal payment"""
        if not PAYPAL_AVAILABLE:
            return False, {"error": "PayPal not configured"}

        try:
            payment = PayPalPayment.find(payment_id)

            if payment.execute({"payer_id": payer_id}):
                return True, {
                    'payment_id': payment.id,
                    'state': payment.state,
                    'payer_email': payment.payer.payer_info.email
                }

            return False, {"error": payment.error}

        except Exception as e:
            logger.error(f"PayPal execution failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def create_subscription(plan_id: str, return_url: str, cancel_url: str) -> Tuple[bool, Dict]:
        """Create PayPal subscription"""
        if not PAYPAL_AVAILABLE:
            return False, {"error": "PayPal not configured"}

        try:
            # Note: Requires PayPal Billing Plan setup
            # Implementation depends on your billing plan structure
            logger.info(f"Creating PayPal subscription for plan: {plan_id}")
            return True, {"subscription_id": "pending_implementation"}
        except Exception as e:
            logger.error(f"PayPal subscription failed: {e}")
            return False, {"error": str(e)}


# ==================== Yandex.Kassa (YooMoney) Integration ====================

class YandexKassaService:
    """
    Yandex.Kassa (now YooMoney) integration for Russia/CIS markets

    Documentation: https://yookassa.ru/developers
    """

    SHOP_ID = os.getenv('YANDEX_SHOP_ID', '')
    SECRET_KEY = os.getenv('YANDEX_SECRET_KEY', '')
    API_URL = "https://api.yookassa.ru/v3"

    @staticmethod
    def create_payment(amount: Decimal, currency: str, return_url: str, description: str = "") -> Tuple[bool, Dict]:
        """Create Yandex.Kassa payment"""
        if not YandexKassaService.SHOP_ID or not YandexKassaService.SECRET_KEY:
            return False, {"error": "Yandex.Kassa not configured"}

        try:
            import requests
            import uuid
            from requests.auth import HTTPBasicAuth

            payment_data = {
                "amount": {
                    "value": str(amount),
                    "currency": currency.upper()
                },
                "confirmation": {
                    "type": "redirect",
                    "return_url": return_url
                },
                "capture": True,
                "description": description
            }

            response = requests.post(
                f"{YandexKassaService.API_URL}/payments",
                json=payment_data,
                auth=HTTPBasicAuth(YandexKassaService.SHOP_ID, YandexKassaService.SECRET_KEY),
                headers={
                    "Idempotence-Key": str(uuid.uuid4()),
                    "Content-Type": "application/json"
                }
            )

            if response.status_code == 200:
                data = response.json()
                return True, {
                    'payment_id': data['id'],
                    'confirmation_url': data['confirmation']['confirmation_url'],
                    'status': data['status']
                }

            return False, {"error": response.text}

        except Exception as e:
            logger.error(f"Yandex.Kassa payment failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def verify_payment(payment_id: str) -> Tuple[bool, Dict]:
        """Verify Yandex.Kassa payment status"""
        if not YandexKassaService.SHOP_ID or not YandexKassaService.SECRET_KEY:
            return False, {"error": "Yandex.Kassa not configured"}

        try:
            import requests
            from requests.auth import HTTPBasicAuth

            response = requests.get(
                f"{YandexKassaService.API_URL}/payments/{payment_id}",
                auth=HTTPBasicAuth(YandexKassaService.SHOP_ID, YandexKassaService.SECRET_KEY)
            )

            if response.status_code == 200:
                data = response.json()
                return True, {
                    'status': data['status'],
                    'paid': data['paid'],
                    'amount': data['amount']['value']
                }

            return False, {"error": response.text}

        except Exception as e:
            logger.error(f"Yandex.Kassa verification failed: {e}")
            return False, {"error": str(e)}


# ==================== Alipay/WeChat Integration ====================

class AlipayWeChatService:
    """
    Alipay and WeChat Pay integration for Chinese market

    Note: This requires proper merchant account setup with Alipay/WeChat
    """

    ALIPAY_PARTNER_ID = os.getenv('ALIPAY_PARTNER_ID', '')
    ALIPAY_KEY = os.getenv('ALIPAY_KEY', '')
    WECHAT_APP_ID = os.getenv('WECHAT_APP_ID', '')
    WECHAT_MCH_ID = os.getenv('WECHAT_MCH_ID', '')
    WECHAT_API_KEY = os.getenv('WECHAT_API_KEY', '')

    @staticmethod
    def create_alipay_payment(amount: Decimal, order_id: str, return_url: str) -> Tuple[bool, Dict]:
        """Create Alipay payment"""
        if not AlipayWeChatService.ALIPAY_PARTNER_ID:
            return False, {"error": "Alipay not configured"}

        try:
            # Note: This is a simplified example
            # Real implementation requires proper Alipay SDK
            logger.info(f"Creating Alipay payment for order: {order_id}")

            payment_url = f"https://mapi.alipay.com/gateway.do?_input_charset=utf-8"

            return True, {
                'payment_method': 'alipay',
                'payment_url': payment_url,
                'order_id': order_id
            }

        except Exception as e:
            logger.error(f"Alipay payment failed: {e}")
            return False, {"error": str(e)}

    @staticmethod
    def create_wechat_payment(amount: Decimal, order_id: str, description: str) -> Tuple[bool, Dict]:
        """Create WeChat Pay payment"""
        if not AlipayWeChatService.WECHAT_MCH_ID:
            return False, {"error": "WeChat Pay not configured"}

        try:
            # Note: This requires WeChat Pay SDK
            # Real implementation needs proper signature and XML formatting
            logger.info(f"Creating WeChat payment for order: {order_id}")

            return True, {
                'payment_method': 'wechat',
                'order_id': order_id,
                'qr_code': 'pending_implementation'
            }

        except Exception as e:
            logger.error(f"WeChat Pay failed: {e}")
            return False, {"error": str(e)}

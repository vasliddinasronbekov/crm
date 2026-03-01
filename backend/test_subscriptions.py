#!/usr/bin/env python3
"""
Subscription & Payment System Test Script

Tests all subscription endpoints including:
- Plans listing
- User subscriptions
- Payment processing
- Invoice generation
- Coupon validation
- Statistics dashboard
"""

import requests
from pprint import pprint
import json
from decimal import Decimal

# Configuration
BASE_URL = "http://localhost:8008"
API_BASE = f"{BASE_URL}/api/subscriptions"

# Test credentials (use existing admin user or create one)
# Update these with your actual admin credentials
ADMIN_EMAIL = "admin"  # or your admin email
ADMIN_PASSWORD = "admin123"  # Update with actual password

def get_auth_token(email, password):
    """Get JWT token for authentication"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login/",
        json={"email": "admin", "password": "admin123"}
    )
    if response.status_code == 200:
        return response.json()['access']
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.json())
        return None

def test_plans(token):
    """Test subscription plans endpoints"""
    print("\n" + "="*60)
    print("🎯 TESTING SUBSCRIPTION PLANS")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. List all plans
    print("\n📋 Listing all subscription plans...")
    response = requests.get(f"{API_BASE}/plans/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        plans = data.get('results', data) if isinstance(data, dict) else data

        if plans:
            print(f"✅ Found {len(plans)} plans:")
            for plan in plans:
                print(f"  - {plan['name']}: {plan['price']} {plan['currency']}/{plan['interval']}")
            return plans[0]['id'] if plans else None
        else:
            print("⚠️  No plans found. Creating sample plan...")
            # Create a sample plan via admin
            return create_sample_plan(token)
    else:
        print(f"❌ Failed: {response.json()}")
        return None

    # 2. Featured plans
    print("\n⭐ Listing featured plans...")
    response = requests.get(f"{API_BASE}/plans/featured/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        featured = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(featured) if featured else 0} featured plans")

def create_sample_plan(token):
    """Create a sample plan via Django shell (admin only)"""
    print("\nℹ️  To create plans, use Django admin or shell:")
    print("""
    from subscriptions.models import SubscriptionPlan

    SubscriptionPlan.objects.create(
        name='Basic Plan',
        slug='basic',
        description='Perfect for small teams',
        price=29.99,
        currency='USD',
        interval='monthly',
        trial_period_days=14,
        features=['Up to 10 users', '5 courses', '10GB storage'],
        max_users=10,
        max_courses=5,
        max_storage_gb=10,
        is_active=True,
        is_featured=True
    )
    """)
    return None

def test_subscriptions(token, plan_id):
    """Test user subscription endpoints"""
    print("\n" + "="*60)
    print("📝 TESTING USER SUBSCRIPTIONS")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. List user subscriptions
    print("\n📋 Listing my subscriptions...")
    response = requests.get(f"{API_BASE}/subscriptions/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        subs = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(subs) if subs else 0} subscriptions")
        if subs:
            pprint(subs[0])
            return subs[0]['id']

    # 2. Get current subscription
    print("\n🔍 Getting my active subscription...")
    response = requests.get(f"{API_BASE}/subscriptions/my_subscription/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        sub = response.json()
        print(f"✅ Active subscription:")
        print(f"  Plan: {sub.get('plan', {}).get('name', 'N/A')}")
        print(f"  Status: {sub['status']}")
        print(f"  Period End: {sub['current_period_end']}")
        return sub['id']
    elif response.status_code == 404:
        print("ℹ️  No active subscription found")
        return None
    else:
        print(f"❌ Error: {response.json()}")
        return None

def test_payments(token, subscription_id=None):
    """Test payment endpoints"""
    print("\n" + "="*60)
    print("💳 TESTING PAYMENTS")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. List payments
    print("\n📋 Listing payment history...")
    response = requests.get(f"{API_BASE}/payments/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        payments = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(payments) if payments else 0} payments")
        if payments:
            for payment in payments[:3]:  # Show first 3
                print(f"  - {payment['amount']} {payment['currency']} - {payment['status']}")

    # 2. Create payment (test mode)
    print("\n💰 Creating test payment...")
    payment_data = {
        "amount": "99.99",
        "currency": "USD",
        "payment_method": "stripe_card",
        "description": "Test payment for subscription"
    }
    if subscription_id:
        payment_data['subscription_id'] = subscription_id

    response = requests.post(
        f"{API_BASE}/payments/",
        headers=headers,
        json=payment_data
    )
    print(f"Status: {response.status_code}")

    if response.status_code == 201:
        payment = response.json()
        print(f"✅ Payment created:")
        print(f"  ID: {payment['id']}")
        print(f"  Amount: {payment['amount']} {payment['currency']}")
        print(f"  Status: {payment['status']}")
        return payment['id']
    else:
        print(f"❌ Failed: {response.json()}")
        return None

def test_invoices(token):
    """Test invoice endpoints"""
    print("\n" + "="*60)
    print("🧾 TESTING INVOICES")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # List invoices
    print("\n📋 Listing invoices...")
    response = requests.get(f"{API_BASE}/invoices/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        invoices = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(invoices) if invoices else 0} invoices")
        if invoices:
            for invoice in invoices[:3]:
                print(f"  - {invoice['invoice_number']}: {invoice['total']} {invoice['currency']} - {invoice['status']}")

def test_payment_methods(token):
    """Test saved payment methods"""
    print("\n" + "="*60)
    print("💳 TESTING PAYMENT METHODS")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # List payment methods
    print("\n📋 Listing saved payment methods...")
    response = requests.get(f"{API_BASE}/payment-methods/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        methods = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(methods) if methods else 0} saved payment methods")
        if methods:
            for method in methods:
                print(f"  - {method['method_type']}: {'(default)' if method['is_default'] else ''}")

def test_coupons(token):
    """Test coupon validation"""
    print("\n" + "="*60)
    print("🎟️  TESTING COUPONS")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # Validate coupon
    print("\n🔍 Validating coupon code...")
    coupon_data = {
        "code": "WELCOME10",
        "amount": "99.99"
    }

    response = requests.post(
        f"{API_BASE}/coupons/validate/",
        headers=headers,
        json=coupon_data
    )
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print(f"✅ Coupon valid:")
        pprint(result)
    else:
        print(f"ℹ️  Coupon not found or invalid")
        print("💡 Create coupons via Django admin")

def test_stats(token):
    """Test subscription statistics (admin only)"""
    print("\n" + "="*60)
    print("📊 TESTING STATISTICS (Admin Only)")
    print("="*60)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Subscription overview
    print("\n📈 Getting subscription overview...")
    response = requests.get(f"{API_BASE}/stats/overview/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        stats = response.json()
        print(f"✅ Subscription Stats:")
        print(f"  Active Subscriptions: {stats['total_active_subscriptions']}")
        print(f"  Total Revenue: ${stats['total_revenue']}")
        print(f"  MRR: ${stats['mrr']}")
        print(f"  ARR: ${stats['arr']}")
        print(f"  Total Customers: {stats['total_customers']}")
    elif response.status_code == 403:
        print("⚠️  Admin access required for statistics")
    else:
        print(f"❌ Error: {response.json()}")

    # 2. Revenue stats
    print("\n💰 Getting revenue stats...")
    response = requests.get(f"{API_BASE}/stats/revenue/", headers=headers)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        stats = response.json()
        print(f"✅ Revenue Stats:")
        print(f"  Total Revenue: ${stats['total_revenue']}")
        print(f"  Successful Payments: {stats['successful_payments']}")
        print(f"  Failed Payments: {stats['failed_payments']}")
        print(f"  Avg Transaction: ${stats['avg_transaction_value']}")

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚀 SUBSCRIPTION SYSTEM TEST SUITE")
    print("="*60)

    # Get auth token
    print("\n🔐 Authenticating...")
    token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)

    if not token:
        print("\n❌ Authentication failed. Please check credentials.")
        print(f"   Email: {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
        return

    print(f"✅ Authenticated successfully")

    # Run tests
    plan_id = test_plans(token)
    subscription_id = test_subscriptions(token, plan_id)
    payment_id = test_payments(token, subscription_id)
    test_invoices(token)
    test_payment_methods(token)
    test_coupons(token)
    test_stats(token)

    print("\n" + "="*60)
    print("✅ ALL TESTS COMPLETED")
    print("="*60)
    print("\n📌 Next Steps:")
    print("  1. Create subscription plans via Django admin")
    print("  2. Configure Stripe API keys in .env")
    print("  3. Set up Payme/Click merchant IDs")
    print("  4. Create test coupons")
    print("  5. Test payment webhooks")
    print("\n")

if __name__ == "__main__":
    main()

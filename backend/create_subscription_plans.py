#!/usr/bin/env python3
"""
Create Sample Subscription Plans

Run this script to populate the database with subscription plans.
"""
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from subscriptions.models import SubscriptionPlan

def create_plans():
    """Create sample subscription plans"""

    # Clear existing plans (optional)
    print("🗑️  Clearing existing plans...")
    SubscriptionPlan.objects.all().delete()

    plans_data = [
        {
            'name': 'Free',
            'slug': 'free',
            'description': 'Perfect for trying out the platform',
            'price': 0,
            'currency': 'USD',
            'interval': 'lifetime',
            'trial_period_days': 0,
            'features': [
                '1 user',
                '1 course',
                '1GB storage',
                'Community support',
                'Basic features'
            ],
            'max_users': 1,
            'max_courses': 1,
            'max_storage_gb': 1,
            'is_active': True,
            'is_featured': False,
            'display_order': 1
        },
        {
            'name': 'Starter',
            'slug': 'starter',
            'description': 'Great for individuals and freelancers',
            'price': 19.99,
            'currency': 'USD',
            'interval': 'monthly',
            'trial_period_days': 14,
            'features': [
                'Up to 5 users',
                '3 courses',
                '5GB storage',
                'Email support',
                'All basic features',
                'Mobile app access'
            ],
            'max_users': 5,
            'max_courses': 3,
            'max_storage_gb': 5,
            'is_active': True,
            'is_featured': False,
            'display_order': 2
        },
        {
            'name': 'Professional',
            'slug': 'professional',
            'description': 'For growing teams and small businesses',
            'price': 49.99,
            'currency': 'USD',
            'interval': 'monthly',
            'trial_period_days': 14,
            'features': [
                'Up to 25 users',
                '10 courses',
                '50GB storage',
                'Priority email support',
                'Advanced analytics',
                'Custom branding',
                'API access',
                'Zoom integration'
            ],
            'max_users': 25,
            'max_courses': 10,
            'max_storage_gb': 50,
            'is_active': True,
            'is_featured': True,
            'display_order': 3,
            'stripe_price_id': 'price_professional_monthly',  # Add real Stripe price ID
            'stripe_product_id': 'prod_professional'
        },
        {
            'name': 'Business',
            'slug': 'business',
            'description': 'For established organizations',
            'price': 99.99,
            'currency': 'USD',
            'interval': 'monthly',
            'trial_period_days': 30,
            'features': [
                'Up to 100 users',
                'Unlimited courses',
                '200GB storage',
                'Priority support (24/7)',
                'Advanced analytics & reports',
                'White-label solution',
                'API access',
                'All integrations',
                'Custom integrations',
                'Dedicated account manager'
            ],
            'max_users': 100,
            'max_courses': None,  # Unlimited
            'max_storage_gb': 200,
            'is_active': True,
            'is_featured': True,
            'display_order': 4,
            'stripe_price_id': 'price_business_monthly',
            'stripe_product_id': 'prod_business'
        },
        {
            'name': 'Enterprise',
            'slug': 'enterprise',
            'description': 'Custom solutions for large organizations',
            'price': 299.99,
            'currency': 'USD',
            'interval': 'monthly',
            'trial_period_days': 30,
            'features': [
                'Unlimited users',
                'Unlimited courses',
                'Unlimited storage',
                'Dedicated support team',
                'Custom analytics',
                'Complete white-label',
                'Advanced API access',
                'SSO/SAML integration',
                'Custom integrations',
                'SLA guarantee (99.9%)',
                'Dedicated infrastructure',
                'On-premise deployment option'
            ],
            'max_users': None,  # Unlimited
            'max_courses': None,
            'max_storage_gb': None,
            'is_active': True,
            'is_featured': True,
            'display_order': 5,
            'stripe_price_id': 'price_enterprise_monthly',
            'stripe_product_id': 'prod_enterprise'
        },
        # Yearly plans (20% discount)
        {
            'name': 'Professional Annual',
            'slug': 'professional-annual',
            'description': 'Professional plan - Save 20% with annual billing',
            'price': 479.99,  # ~$40/month instead of $49.99
            'currency': 'USD',
            'interval': 'yearly',
            'trial_period_days': 14,
            'features': [
                'Up to 25 users',
                '10 courses',
                '50GB storage',
                'Priority email support',
                'Advanced analytics',
                'Custom branding',
                'API access',
                'Zoom integration',
                '💰 Save 20% vs monthly'
            ],
            'max_users': 25,
            'max_courses': 10,
            'max_storage_gb': 50,
            'is_active': True,
            'is_featured': False,
            'display_order': 6,
            'stripe_price_id': 'price_professional_yearly',
            'stripe_product_id': 'prod_professional'
        },
        {
            'name': 'Business Annual',
            'slug': 'business-annual',
            'description': 'Business plan - Save 20% with annual billing',
            'price': 959.99,  # ~$80/month instead of $99.99
            'currency': 'USD',
            'interval': 'yearly',
            'trial_period_days': 30,
            'features': [
                'Up to 100 users',
                'Unlimited courses',
                '200GB storage',
                'Priority support (24/7)',
                'Advanced analytics & reports',
                'White-label solution',
                'API access',
                'All integrations',
                'Custom integrations',
                'Dedicated account manager',
                '💰 Save 20% vs monthly'
            ],
            'max_users': 100,
            'max_courses': None,
            'max_storage_gb': 200,
            'is_active': True,
            'is_featured': False,
            'display_order': 7,
            'stripe_price_id': 'price_business_yearly',
            'stripe_product_id': 'prod_business'
        }
    ]

    print(f"\n📦 Creating {len(plans_data)} subscription plans...\n")

    created_plans = []
    for plan_data in plans_data:
        plan = SubscriptionPlan.objects.create(**plan_data)
        created_plans.append(plan)

        icon = '🆓' if plan.price == 0 else '💳'
        print(f"{icon} {plan.name}")
        print(f"   Price: ${plan.price} {plan.currency}/{plan.interval}")
        print(f"   Features: {len(plan.features)} features")
        print(f"   Trial: {plan.trial_period_days} days")
        print(f"   Users: {plan.max_users or '∞'}")
        print()

    print(f"✅ Successfully created {len(created_plans)} plans!\n")

    # Display summary
    print("📊 Summary:")
    print(f"   Total Plans: {SubscriptionPlan.objects.count()}")
    print(f"   Active Plans: {SubscriptionPlan.objects.filter(is_active=True).count()}")
    print(f"   Featured Plans: {SubscriptionPlan.objects.filter(is_featured=True).count()}")
    print(f"   Free Plans: {SubscriptionPlan.objects.filter(price=0).count()}")

    return created_plans

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎯 SUBSCRIPTION PLANS CREATION")
    print("="*60)

    create_plans()

    print("\n" + "="*60)
    print("✅ DONE! Access plans at: https://api.crmai.uz/admin/subscriptions/subscriptionplan/")
    print("="*60 + "\n")

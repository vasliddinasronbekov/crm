#!/usr/bin/env python3
"""
Create Admin User for Testing
"""
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_project.settings')
django.setup()

from users.models import User

# Check if admin exists
admin = User.objects.filter(is_superuser=True).first()

if admin:
    print(f"✅ Admin user already exists:")
    print(f"   Email/Username: {admin.email or admin.username}")
    print(f"   ID: {admin.id}")
    print(f"   Name: {admin.get_full_name()}")
    print(f"\n   Use this for login:")
    print(f"   Email: {admin.email or admin.username}")
    print(f"   (Password from your database)")
else:
    print("Creating admin user...")
    try:
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@test.com',
            password='admin123',
            first_name='Admin',
            last_name='User',
            phone='1234567890'
        )
        print(f"✅ Admin user created successfully!")
        print(f"   Email: {admin.email}")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   ID: {admin.id}")
    except Exception as e:
        print(f"⚠️  Could not create admin: {e}")
        print(f"   Fetching existing superuser...")
        admin = User.objects.filter(is_superuser=True).first()
        if admin:
            print(f"   Found: {admin.email or admin.username}")

# /mnt/usb/edu-api-project/student_profile/test_groups.py

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User
from .models import Group, Branch, Course, Room

@pytest.mark.django_db
def test_student_cannot_create_group():
    """
    Oddiy student (is_teacher=False) yangi guruh yarata olmasligini tekshiradi.
    """
    # 1. Tayyorgarlik (Arrange)
    student_user = User.objects.create_user(username='teststudent', password='password123', is_teacher=False)
    client = APIClient()
    
    # client.force_authenticate() - bu token olish jarayonini o'tkazib yuborib,
    # so'rovlarni to'g'ridan-to'g'ri shu foydalanuvchi nomidan yuborish imkonini beradi.
    client.force_authenticate(user=student_user)
    
    # Guruh yaratish uchun kerakli bo'lgan boshqa ob'ektlarni yaratamiz
    branch = Branch.objects.create(name="Test Filial")
    course = Course.objects.create(name="Test Kurs", price=100)
    room = Room.objects.create(name="Test Xona", branch=branch)
    
    group_data = {
        "name": "Yangi Guruh Student tomonidan",
        "branch": branch.id,
        "course": course.id,
        "room": room.id,
        "start_day": "2025-09-01",
        "end_day": "2026-05-31",
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "days": "Dush, Chor, Juma"
    }

    # 2. Harakat (Act)
    # Guruh yaratish uchun POST so'rovini yuboramiz
    response = client.post('/api/v1/mentor/group/', group_data, format='json')

    # 3. Tasdiqlash (Assert)
    # Javob "Ruxsat yo'q" (403 Forbidden) bo'lishi kerak
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_teacher_can_create_group():
    """
    O'qituvchi (is_teacher=True) yangi guruh yarata olishini tekshiradi.
    """
    # 1. Tayyorgarlik (Arrange)
    teacher_user = User.objects.create_user(username='testteacher', password='password123', is_teacher=True)
    client = APIClient()
    client.force_authenticate(user=teacher_user)
    
    branch = Branch.objects.create(name="Test Filial")
    course = Course.objects.create(name="Test Kurs", price=100)
    room = Room.objects.create(name="Test Xona", branch=branch)
    
    group_data = {
        "name": "Yangi Guruh O'qituvchi tomonidan",
        "branch": branch.id,
        "course": course.id,
        "room": room.id,
        "start_day": "2025-09-01",
        "end_day": "2026-05-31",
        "start_time": "09:00:00",
        "end_time": "11:00:00",
        "days": "Dush, Chor, Juma"
    }

    # 2. Harakat (Act)
    response = client.post('/api/v1/mentor/group/', group_data, format='json')

    # 3. Tasdiqlash (Assert)
    # Javob "Yaratildi" (201 Created) bo'lishi kerak
    assert response.status_code == status.HTTP_201_CREATED
    # Ma'lumotlar bazasida guruhlar soni 1 ga teng bo'lishi kerak
    assert Group.objects.count() == 1
    # Yaratilgan guruhning nomi to'g'ri ekanligini tekshirish
    assert Group.objects.first().name == "Yangi Guruh O'qituvchi tomonidan"

# /mnt/usb/edu-api-project/student_profile/test_statistics.py

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User
from .models import Group, Attendance, ExamScore, StudentCoins, Payment

@pytest.mark.django_db
def test_student_statistics_calculation():
    """
    /student/statistics/ endpoint'i ma'lumotlarni to'g'ri hisoblayotganini tekshiradi.
    """
    # 1. TAYYORGARLIK (Arrange)
    # Test uchun kerakli barcha ma'lumotlarni yaratamiz
    client = APIClient()
    student = User.objects.create_user(username='statstudent', password='password123')
    group = Group.objects.create(
        name="Statistika Test Guruhi",
        start_day="2025-01-01",
        end_day="2025-12-31",
        start_time="09:00",
        end_time="11:00",
        days="Seshanba"
    )
    group.students.add(student)

    # Davomatlar: 4 ta darsdan 3 tasiga kelgan (75%)
    Attendance.objects.create(student=student, group=group, date="2025-08-01", is_present=True)
    Attendance.objects.create(student=student, group=group, date="2025-08-02", is_present=True)
    Attendance.objects.create(student=student, group=group, date="2025-08-03", is_present=True)
    Attendance.objects.create(student=student, group=group, date="2025-08-04", is_present=False)

    # Imtihon baholari: 80 va 100 (o'rtachasi 90)
    ExamScore.objects.create(student=student, score=80, date="2025-08-05")
    ExamScore.objects.create(student=student, score=100, date="2025-08-06")

    # Coinlar: 50 + 25 = 75
    StudentCoins.objects.create(student=student, coin=50, reason="Aktivlik uchun")
    StudentCoins.objects.create(student=student, coin=25, reason="Topshiriq uchun")
    
    # To'lovlar: 500,000 + 200,000 = 700,000 so'm (70,000,000 tiyin)
    Payment.objects.create(by_user=student, amount=50000000, status=Payment.PaymentStatus.PAID, date="2025-08-01", course_price=0)
    Payment.objects.create(by_user=student, amount=20000000, status=Payment.PaymentStatus.PAID, date="2025-08-02", course_price=0)
    
    # So'rovni shu student nomidan yuborish uchun autentifikatsiya qilamiz
    client.force_authenticate(user=student)

    # 2. HARAKAT (Act)
    # Statistika endpoint'iga so'rov yuboramiz
    response = client.get('/api/v1/student-profile/student/statistics/')

    # 3. TASDIQLASH (Assert)
    # Qaytgan javob biz kutgan natijalarga mos ekanligini tekshiramiz
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert data['group_count'] == 1
    assert data['attendance_percentage'] == 75.00
    assert data['average_score'] == 90.00
    assert data['total_coins'] == 75
    assert data['total_payments'] == 70000000

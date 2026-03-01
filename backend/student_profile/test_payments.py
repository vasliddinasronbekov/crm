# /mnt/usb/edu-api-project/student_profile/test_payments.py

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User
from .models import Payment

@pytest.mark.django_db
class TestPaymentPermissions:
    # Test uchun umumiy ma'lumotlarni tayyorlab olamiz
    def setup_method(self):
        self.client = APIClient()
        self.student1 = User.objects.create_user(username='student1', password='password123')
        self.student2 = User.objects.create_user(username='student2', password='password123')
        self.teacher = User.objects.create_user(username='teacher', password='password123', is_teacher=True)
        
        # Har bir student uchun to'lov yaratamiz
        self.payment1 = Payment.objects.create(by_user=self.student1, amount=50000000, status=Payment.PaymentStatus.PAID, date="2025-08-01", course_price=0)
        self.payment2 = Payment.objects.create(by_user=self.student2, amount=60000000, status=Payment.PaymentStatus.PAID, date="2025-08-02", course_price=0)

    def test_student_can_only_see_own_payments(self):
        """
        Talaba GET so'rovida faqat o'zining to'lovlarini ko'ra olishini tekshiradi.
        """
        # 1-student nomidan tizimga kiramiz
        self.client.force_authenticate(user=self.student1)
        
        # To'lovlar ro'yxatini so'raymiz
        response = self.client.get('/api/v1/payment/')
        
        # Natijalarni tekshiramiz
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        # Javobda faqat bitta to'lov bo'lishi kerak
        assert len(response_data) == 1
        # Va bu to'lov aynan 1-studentniki bo'lishi kerak
        assert response_data[0]['id'] == self.payment1.id
        assert response_data[0]['by_user']['id'] == self.student1.id

    def test_teacher_can_see_all_payments(self):
        """
        O'qituvchi GET so'rovida barcha to'lovlarni ko'ra olishini tekshiradi.
        """
        # O'qituvchi nomidan tizimga kiramiz
        self.client.force_authenticate(user=self.teacher)
        
        # To'lovlar ro'yxatini so'raymiz
        response = self.client.get('/api/v1/payment/')
        
        # Natijalarni tekshiramiz
        assert response.status_code == status.HTTP_200_OK
        
        response_data = response.json()
        # Javobda ikkala to'lov ham bo'lishi kerak
        assert len(response_data) == 2
        
        # Javobda ikkala studentning ham to'lov ID'lari borligini tekshiramiz
        payment_ids = {payment['id'] for payment in response_data}
        assert self.payment1.id in payment_ids
        assert self.payment2.id in payment_ids

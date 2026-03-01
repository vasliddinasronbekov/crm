# /mnt/usb/edu-api-project/users/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser
from core.models import Region

class GenderEnum(models.TextChoices):
    MALE = 'Male', 'Male'
    FEMALE = 'Female', 'Female'

class User(AbstractUser):
    # AbstractUser o'zida username, first_name, last_name, email, password 
    # kabi standart maydonlarni saqlaydi.

    # Biz qo'shgan asosiy maydonlar
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_teacher = models.BooleanField(default=False)
    
    # Keyinchalik qo'shilgan, profil uchun maydonlar
    parents_phone = models.CharField(max_length=20, blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GenderEnum.choices, blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)
    photo = models.ImageField(upload_to='user_photos/', blank=True, null=True)
    
    # `CharField`'dan `ForeignKey`'ga o'zgartirilgan maydon
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, blank=True, null=True)
    
    # HR moduli uchun qo'shilgan maydon
    salary_percentage = models.PositiveIntegerField(default=40, help_text="O'qituvchining to'lovlardan oladigan foizi")

    # Reytingni saqlash uchun maydon
    rank = models.PositiveIntegerField(null=True, blank=True, default=0, help_text="Talabaning hisoblangan reytingdagi o'rni")

    # Ko'p filialli tizim uchun maydon
    branch = models.ForeignKey(
        'student_profile.Branch', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='staff'
    )

    def __str__(self):
        return self.username

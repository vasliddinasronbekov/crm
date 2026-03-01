# /mnt/usb/edu-api-project/crm/models.py

from django.db import models
from users.models import User
from student_profile.models import Course, Branch

class Source(models.Model):
    """Qaysi manbadan kelganini aniqlash uchun (Instagram, Telegram, tanishlar...)"""
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class LeadDepartment(models.Model):
    """Lidlar bilan ishlaydigan bo'lim (masalan, Marketing, Sotuv)"""
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class SubDepartment(models.Model):
    """Bo'lim ichidagi kichik bo'linma (masalan, Instagram marketing, Targetologiya)"""
    name = models.CharField(max_length=100)
    department = models.ForeignKey(LeadDepartment, on_delete=models.CASCADE, related_name='sub_departments')

    def __str__(self):
        return f"{self.department.name} - {self.name}"

class Lead(models.Model):
    """Potentsial o'quvchi (Lid)"""
    STATUS_CHOICES = [
        ('new', 'Yangi'),
        ('in_progress', 'Jarayonda'),
        ('converted', "O'quvchiga aylandi"),
        ('rejected', 'Rad etildi'),
    ]

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, unique=True, help_text="Telefon raqami +998XXYYYYYYY formatida")
    source = models.ForeignKey(Source, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey(LeadDepartment, on_delete=models.SET_NULL, null=True, blank=True)
    sub_department = models.ForeignKey(SubDepartment, on_delete=models.SET_NULL, null=True, blank=True)
    interested_course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responsible_person = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # Lidga mas'ul xodim

    def __str__(self):
        return f"{self.full_name} ({self.phone})"
# Import activity and pipeline models
from .activity_models import Activity, Pipeline, PipelineStage, Deal

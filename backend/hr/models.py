# /mnt/usb/edu-api-project/hr/models.py

from django.db import models
from users.models import User
from student_profile.models import Group # Group modelini import qilamiz

class TeacherSalary(models.Model):
    """
    O'qituvchining ma'lum bir oy uchun hisoblangan oylik maoshini saqlaydi.
    """
    STATUS_CHOICES = [
        ('calculated', 'Hisoblangan'),
        ('paid', 'To\'langan'),
        ('rejected', 'Bekor qilingan'),
    ]
    
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salaries', limit_choices_to={'is_teacher': True})
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Hisoblangan oylik maosh summasi")
    month = models.DateField(help_text="Oylik maosh qaysi oy uchun ekanligi (masalan, 2025-08-01)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='calculated')
    comment = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    calculated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='calculated_salaries')

    class Meta:
        # Bir o'qituvchi uchun bir oyda faqat bitta oylik hisoboti bo'lishi kerak
        unique_together = ('teacher', 'month')
        ordering = ['-month', 'teacher']

    def __str__(self):
        return f"{self.teacher.get_full_name()} - {self.month.strftime('%B %Y')} - {self.amount}"

class Salary(models.Model):
    """
    Mentorning (o'qituvchining) har bir guruhi uchun alohida oylik maoshini saqlaydi.
    """
    mentor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_salaries', limit_choices_to={'is_teacher': True})
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='salaries_for_mentor')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.DateField(help_text="Qaysi oy uchun hisoblanganligi")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('mentor', 'group', 'month')
        ordering = ['-month', 'mentor']

    def __str__(self):
        return f"Salary for {self.mentor.get_full_name()} in {self.group.name} for {self.month.strftime('%B %Y')}"

# /mnt/usb/edu-api-project/hr/admin.py
from django.contrib import admin
from .models import TeacherSalary, Salary

admin.site.register(TeacherSalary)

admin.site.register(Salary)
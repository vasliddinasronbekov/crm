# /mnt/usb/edu-api-project/crm/admin.py
from django.contrib import admin
from .models import Source, LeadDepartment, SubDepartment, Lead

admin.site.register(Source)
admin.site.register(LeadDepartment)
admin.site.register(SubDepartment)
admin.site.register(Lead)
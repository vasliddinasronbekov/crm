# /mnt/usb/edu-api-project/messaging/admin.py
from django.contrib import admin
from .models import MessageTemplate, SmsHistory, AutomaticMessage

admin.site.register(MessageTemplate)
admin.site.register(SmsHistory)
admin.site.register(AutomaticMessage)
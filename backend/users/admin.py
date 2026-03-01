# /mnt/usb/edu-api-project/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

# Maxsus User modelimiz uchun standart UserAdmin panelini ishlatamiz.
# Bu bizga parol o'zgartirish, ruxsatnomalar berish kabi 
# barcha qulayliklarni taqdim etadi.
admin.site.register(User, UserAdmin)
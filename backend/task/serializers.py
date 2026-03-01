# /mnt/usb/edu-api-project/task/serializers.py fayli

from rest_framework import serializers
from .models import Board, List, Task, AutoTask
from users.models import User # users app'idagi modelimizni ishlatamiz
from users.serializers import UserSerializer  # Foydalanuvchi serializer'ini import qilamiz
# Task (vazifa) uchun serializer
class TaskSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = Task
        fields = '__all__'

# === MUAMMO SHU YERDA BO'LISHI MUMKIN ===
# List (ro'yxat) uchun serializer. Ichida vazifalarni ham ko'rsatadi.
class ListSerializer(serializers.ModelSerializer):
    tasks = TaskSerializer(many=True, read_only=True) # Nested serializer

    class Meta:
        model = List
        # Modelda belgilangan barcha maydonlarni qo'shamiz
        fields = ['id', 'name', 'order', 'board', 'color', 'status', 'tasks']

# Board (doska) uchun serializer
class BoardSerializer(serializers.ModelSerializer):
    # Modelda belgilangan barcha maydonlarni qo'shamiz
    class Meta:
        model = Board
        fields = '__all__'
        extra_kwargs = {
            'users': {'required': False},
            'teachers': {'required': False},
        }

# AutoTask (avtomatik vazifa) uchun serializer
class AutoTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutoTask
        fields = '__all__'

# Vazifa yaratish uchun ishlatiladigan alohida serializer'lar
# (Bularni keyinroq, logikani murakkablashtirganda qo'shish mumkin, hozircha shart emas)
# class BoardCreateSerializer(...) va hokazo

class TaskCreateSerializer(serializers.ModelSerializer):
    # `user` maydonini qayta e'lon qilamiz: u endi ID'lar ro'yxatini
    # qabul qiladi va faqat yozish uchun ishlatiladi (javobda ko'rinmaydi).
    users = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True
    )

    class Meta:
        model = Task
        # `user` maydoni modelda bitta bo'lgani uchun uni `fields`'dan olib turamiz,
        # uning o'rniga o'zimiz e'lon qilgan `users`'ni ishlatamiz.
        fields = ['id', 'title', 'description', 'list', 'is_done', 'due_date', 'users']
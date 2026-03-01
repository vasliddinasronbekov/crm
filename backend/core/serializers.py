# /mnt/usb/edu-api-project/core/serializers.py
from rest_framework import serializers
from .models import Region, Comment

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = '__all__'
        depth = 1 # User va Author ma'lumotlarini to'liq ko'rsatish uchun
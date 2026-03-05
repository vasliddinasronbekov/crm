from typing import Any
# /mnt/usb/edu-api-project/users/serializers.py

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from users.models import User
from student_profile.models import Payment, StudentCoins, Group 
from django.db.models import Sum
# /mnt/usb/edu-api-project/users/serializers.py

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from users.models import User
from student_profile.models import Payment, StudentCoins, Group, ExamScore # ExamScore modelini import qilamiz
from django.db.models import Sum, Avg, F, Window
from django.db.models.functions import Rank

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'phone', 'is_teacher']

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
        full_name = f"{user.first_name} {user.last_name}".strip()
        data['id'] = user.id
        data['first_name'] = full_name
        
        # --- FILIAL NOMINI HAQIQIY HISBOLASH ---
        student_branch_name = None
        student_group = Group.objects.filter(students=user).first()
        if student_group and student_group.branch:
            student_branch_name = student_group.branch.name
            
        data['student_branch'] = student_branch_name
        
        data['gender'] = user.gender
        data['birthday'] = user.birthday
        
        # Balansni hisoblash (bu logikani keyinroq, Payment modelini to'g'rilagach, takomillashtiramiz)
        data['balance'] = 0.0
        
        in_group = True if student_group else False
        data['status'] = "In group" if in_group else "Not in group"
        
        data['phone'] = user.phone
        data['parents_phone'] = user.parents_phone
        
        coins_agg = StudentCoins.objects.filter(student=user).aggregate(total=Sum('coin'))
        coins = coins_agg.get('total')
        data['coins'] = coins if coins is not None else 0
        
        # --- O'RTACHA BAHONI (SCORE) HAQIQIY HISBOLASH ---
        avg_score_agg = ExamScore.objects.filter(student=user).aggregate(avg=Avg('score'))
        avg_score = avg_score_agg.get('avg')
        data['score'] = round(avg_score, 2) if avg_score is not None else 0.0
        
        data['photo'] = user.photo.url if user.photo else ""
        data['region'] = user.region
        
        # --- REYTINGNI (RANK) HAQIQIY HISBOLASH ---
        # DIQQAT: Bu usul katta loyihalar uchun sekin ishlashi mumkin.
        # Haqiqiy proyektlarda reyting fonda, alohida hisoblanib turiladi.
        
        # Barcha studentlarning o'rtacha bahosini hisoblaymiz
        all_students_with_avg_score = User.objects.filter(is_teacher=False, is_staff=False).annotate(
            avg_score=Avg('exam_scores__score')
        ).filter(avg_score__isnull=False) # Bahosi yo'qlarni hisobga olmaymiz
        
        # O'rtacha baho bo'yicha kamayish tartibida saralaymiz
        ranked_students = all_students_with_avg_score.order_by('-avg_score')
        
        # Ro'yxatdan joriy studentning o'rnini topamiz
        rank = 0
        student_ids = list(ranked_students.values_list('id', flat=True))
        try:
            rank = student_ids.index(user.id) + 1
        except ValueError:
            # Agar studentning birorta ham bahosi bo'lmasa, u ro'yxatda bo'lmaydi
            rank = "N/A"

        data['ranking'] = {
            "id": user.id,
            "first_name": full_name,
            "student_branch__name": student_branch_name,
            "photo": user.photo.url if user.photo else "",
            "avg_score": data['score'], # Yuqorida hisoblagan natijamiz
            "rank": user.rank if user.rank else "N/A", # Modelning o'zidan o'qish
        }
        
        return data
# Bu sizda avvaldan bor edi va to'g'ri edi
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'phone', 'email', 'photo', 'is_teacher', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'is_teacher', 'is_staff', 'is_superuser']


class TeacherWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'first_name', 'last_name',
            'phone', 'email', 'photo', 'is_staff', 'is_active'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'This field is required.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.setdefault('is_active', True)
        user = User(**validated_data)
        user.is_teacher = True
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.is_teacher = True
        if password:
            instance.set_password(password)

        instance.save()
        return instance


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile viewing and editing
    """
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'parents_phone', 'photo', 'gender', 'birthday',
            'is_teacher', 'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'username', 'is_teacher', 'is_staff', 'is_superuser']


class UserBasicSerializer(serializers.ModelSerializer):
    """
    Basic user info serializer for displaying user details in exam drafts and notifications
    """
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        ref_name = 'UsersUserBasic'
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email', 'photo', 'is_teacher', 'is_staff']
        read_only_fields = fields

    def get_full_name(self, obj) -> Any:
        return obj.get_full_name()


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for password change
    """
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate_old_password(self, value):
        """Verify old password is correct"""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate_new_password(self, value):
        """Validate new password strength"""
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

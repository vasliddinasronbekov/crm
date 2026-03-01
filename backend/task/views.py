# /mnt/usb/edu-api-project/task/views.py fayli

from django.db import models
from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from users.models import User
from .models import Board, List, Task, AutoTask
# Serializer'larni import qilish - faqat asosiylarini qoldiramiz
from .serializers import BoardSerializer, ListSerializer, TaskSerializer, AutoTaskSerializer, TaskCreateSerializer
# from .permissions import IsBoardMemberOrTeacher # Murakkab ruxsatlarni keyinroq qo'shamiz

class BoardViewSet(viewsets.ModelViewSet):
    """
    Board (doska) uchun soddalashtirilgan CRUD amallari.
    """
    queryset = Board.objects.all()
    serializer_class = BoardSerializer  # Faqat bitta asosiy serializer'ni ishlatamiz
    permission_classes = [permissions.IsAuthenticated] # Hozircha oddiy ruxsatnoma

# Qolgan ViewSet'lar o'zgarishsiz qoladi
class ListViewSet(viewsets.ModelViewSet):
    queryset = List.objects.all()
    serializer_class = ListSerializer
    permission_classes = [permissions.IsAuthenticated]

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Task.objects.all()

        # Date filtering - filter by created_at or due_date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            # Filter by either created on that date OR due on that date
            queryset = queryset.filter(
                models.Q(created_at__date=date_param) |
                models.Q(due_date__date=date_param)
            )

        return queryset.select_related('user', 'list').order_by('-created_at')
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AutoTaskViewSet(viewsets.ModelViewSet):
    queryset = AutoTask.objects.all()
    serializer_class = AutoTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

class TaskBulkCreateView(generics.GenericAPIView):
    """
    Bitta vazifani bir nechta foydalanuvchiga birdaniga yaratish uchun.
    """
    serializer_class = TaskCreateSerializer
    permission_classes = [permissions.IsAuthenticated] # Yoki IsTeacher

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        
        user_ids = validated_data.pop('users')
        tasks_created_count = 0
        
        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)
                # Har bir user uchun `validated_data` asosida yangi Task yaratamiz
                Task.objects.create(user=user, **validated_data)
                tasks_created_count += 1
            except User.DoesNotExist:
                # Agar ro'yxatda mavjud bo'lmagan user ID kelsa, o'tkazib yuboramiz
                continue
        
        return Response(
            {"detail": f"{tasks_created_count} ta vazifa muvaffaqiyatli yaratildi."},
            status=status.HTTP_201_CREATED
        )
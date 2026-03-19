# /mnt/usb/edu-api-project/task/views.py fayli

from django.db import models, transaction
from django.db.models import Q
from rest_framework import viewsets, permissions, status, generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from users.models import User
from users.branch_scope import (
    build_direct_user_branch_q,
    build_user_branch_q,
    get_effective_branch_id,
    is_global_branch_user,
    user_belongs_to_branch,
)
from .models import Board, List, Task, AutoTask
# Serializer'larni import qilish - faqat asosiylarini qoldiramiz
from .serializers import BoardSerializer, ListSerializer, TaskSerializer, AutoTaskSerializer, TaskCreateSerializer
# from .permissions import IsBoardMemberOrTeacher # Murakkab ruxsatlarni keyinroq qo'shamiz


def _scoped_boards_queryset(request, user):
    queryset = Board.objects.all()
    active_branch_id = get_effective_branch_id(request, user)

    if is_global_branch_user(user):
        if active_branch_id is None:
            return queryset
    elif active_branch_id is None:
        return queryset.none()

    scoped_queryset = queryset.filter(
        build_user_branch_q(active_branch_id, 'users')
        | build_user_branch_q(active_branch_id, 'teachers')
    ).distinct()
    out_of_scope_users = User.objects.exclude(
        build_direct_user_branch_q(active_branch_id)
    ).distinct()
    return scoped_queryset.exclude(
        users__in=out_of_scope_users
    ).exclude(
        teachers__in=out_of_scope_users
    ).distinct()

class BoardViewSet(viewsets.ModelViewSet):
    """
    Board (doska) uchun soddalashtirilgan CRUD amallari.
    """
    queryset = Board.objects.all()
    serializer_class = BoardSerializer  # Faqat bitta asosiy serializer'ni ishlatamiz
    permission_classes = [permissions.IsAuthenticated] # Hozircha oddiy ruxsatnoma

    def get_queryset(self):
        user = self.request.user
        queryset = _scoped_boards_queryset(self.request, user)

        if not (user.is_superuser or user.is_staff):
            queryset = queryset.filter(Q(users=user) | Q(teachers=user)).distinct()

        return queryset.prefetch_related('users', 'teachers').order_by('id')

    def perform_create(self, serializer):
        user = self.request.user
        active_branch_id = get_effective_branch_id(self.request, user)

        selected_users = list(serializer.validated_data.get('users', []))
        selected_teachers = list(serializer.validated_data.get('teachers', []))

        if active_branch_id is not None:
            invalid_user_ids = [
                member.id
                for member in [*selected_users, *selected_teachers]
                if not user_belongs_to_branch(member, active_branch_id)
            ]
            if invalid_user_ids:
                raise PermissionDenied(
                    f'Users {invalid_user_ids} are outside your active branch scope.'
                )

        board = serializer.save()
        if not board.users.filter(id=user.id).exists() and not board.teachers.filter(id=user.id).exists():
            board.users.add(user)

# Qolgan ViewSet'lar o'zgarishsiz qoladi
class ListViewSet(viewsets.ModelViewSet):
    queryset = List.objects.all()
    serializer_class = ListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        board_queryset = _scoped_boards_queryset(self.request, user)
        queryset = List.objects.filter(board__in=board_queryset).select_related('board').distinct()

        if not (user.is_superuser or user.is_staff):
            queryset = queryset.filter(
                Q(board__users=user) | Q(board__teachers=user)
            ).distinct()

        return queryset.order_by('order', 'id')

    def perform_create(self, serializer):
        board = serializer.validated_data['board']
        allowed = _scoped_boards_queryset(
            self.request,
            self.request.user,
        ).filter(id=board.id).exists()
        if not allowed:
            raise PermissionDenied('You do not have access to this board.')
        serializer.save()

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        board_queryset = _scoped_boards_queryset(self.request, user)
        queryset = Task.objects.filter(list__board__in=board_queryset)

        if not (user.is_superuser or user.is_staff):
            queryset = queryset.filter(
                Q(user=user) | Q(list__board__users=user) | Q(list__board__teachers=user)
            )

        # Date filtering - filter by created_at or due_date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            # Filter by either created on that date OR due on that date
            queryset = queryset.filter(
                models.Q(created_at__date=date_param) |
                models.Q(due_date__date=date_param)
            )

        return queryset.select_related('user', 'list', 'list__board').distinct().order_by('-created_at')
    
    def perform_create(self, serializer):
        task_list = serializer.validated_data.get('list')
        if task_list is None:
            raise PermissionDenied('Task list is required.')

        allowed = List.objects.filter(
            id=task_list.id,
            board__in=_scoped_boards_queryset(self.request, self.request.user),
        ).exists()
        if not allowed:
            raise PermissionDenied('You do not have access to this list.')

        serializer.save(user=self.request.user)

class AutoTaskViewSet(viewsets.ModelViewSet):
    queryset = AutoTask.objects.all()
    serializer_class = AutoTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        board_queryset = _scoped_boards_queryset(self.request, user)
        queryset = AutoTask.objects.filter(list__board__in=board_queryset).select_related('list', 'list__board')

        if not (user.is_superuser or user.is_staff):
            queryset = queryset.filter(
                Q(users=user) | Q(list__board__users=user) | Q(list__board__teachers=user)
            ).distinct()

        return queryset.distinct().order_by('id')

    def perform_create(self, serializer):
        task_list = serializer.validated_data.get('list')
        if task_list is None:
            raise PermissionDenied('Task list is required.')

        allowed = List.objects.filter(
            id=task_list.id,
            board__in=_scoped_boards_queryset(self.request, self.request.user),
        ).exists()
        if not allowed:
            raise PermissionDenied('You do not have access to this list.')

        active_branch_id = get_effective_branch_id(self.request, self.request.user)
        target_users = list(serializer.validated_data.get('users', []))
        if active_branch_id is not None:
            invalid_user_ids = [
                target_user.id
                for target_user in target_users
                if not user_belongs_to_branch(target_user, active_branch_id)
            ]
            if invalid_user_ids:
                raise PermissionDenied(
                    f'Users {invalid_user_ids} are outside your active branch scope.'
                )

        auto_task = serializer.save()
        if not auto_task.users.filter(id=self.request.user.id).exists():
            auto_task.users.add(self.request.user)

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
        task_list = validated_data.get('list')
        if task_list is None:
            raise PermissionDenied('Task list is required.')

        allowed_list = List.objects.filter(
            id=task_list.id,
            board__in=_scoped_boards_queryset(request, request.user),
        ).exists()
        if not allowed_list:
            raise PermissionDenied('You do not have access to this list.')

        active_branch_id = get_effective_branch_id(request, request.user)
        users = list(User.objects.filter(id__in=user_ids))

        if active_branch_id is not None:
            invalid_user_ids = [
                target_user.id
                for target_user in users
                if not user_belongs_to_branch(target_user, active_branch_id)
            ]
            if invalid_user_ids:
                raise PermissionDenied(
                    f'Users {invalid_user_ids} are outside your active branch scope.'
                )

        tasks_created_count = 0
        with transaction.atomic():
            for user in users:
                Task.objects.create(user=user, **validated_data)
                tasks_created_count += 1
        
        return Response(
            {"detail": f"{tasks_created_count} ta vazifa muvaffaqiyatli yaratildi."},
            status=status.HTTP_201_CREATED
        )

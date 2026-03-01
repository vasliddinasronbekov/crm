# /mnt/usb/edu-api-project/hr/views.py

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
import datetime

from .models import TeacherSalary, Salary
from .serializers import TeacherSalarySerializer, TeacherSalaryCreateSerializer, CalculateSalarySerializer, SalarySerializer, SalaryCreateSerializer

class SalaryViewSet(viewsets.ModelViewSet):
    queryset = Salary.objects.all()
    serializer_class = SalarySerializer
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SalaryCreateSerializer
        return SalarySerializer
# Serializerlar endi o'zining faylidan to'g'ri import qilinadi
from users.models import User
from student_profile.models import Payment

class TeacherSalaryViewSet(viewsets.ModelViewSet):
    queryset = TeacherSalary.objects.all()
    serializer_class = TeacherSalarySerializer
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TeacherSalaryCreateSerializer
        return TeacherSalarySerializer

    def perform_create(self, serializer):
        serializer.save(calculated_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='calculate-salary')
    def calculate_salary(self, request):
        serializer = CalculateSalarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        teacher_id = serializer.validated_data['teacher_id']
        month_str = serializer.validated_data['month']
        
        try:
            teacher = User.objects.get(id=teacher_id, is_teacher=True)
            year, month = map(int, month_str.split('-'))
            start_date = datetime.date(year, month, 1)
            next_month = start_date.replace(day=28) + datetime.timedelta(days=4)
            end_date = next_month - datetime.timedelta(days=next_month.day)
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Noto'g'ri o'qituvchi ID'si yoki oy formati."}, status=status.HTTP_400_BAD_REQUEST)
        
        students_in_groups = User.objects.filter(student_groups__main_teacher=teacher).distinct()
        
        total_payments = Payment.objects.filter(
            by_user__in=students_in_groups,
            date__gte=start_date,
            date__lte=end_date
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        calculated_amount = total_payments * (teacher.salary_percentage / 100)
        
        salary_record, created = TeacherSalary.objects.update_or_create(
            teacher=teacher,
            month=start_date,
            defaults={
                'amount': calculated_amount,
                'status': 'calculated',
                'calculated_by': request.user
            }
        )
        
        result_serializer = self.get_serializer(salary_record)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
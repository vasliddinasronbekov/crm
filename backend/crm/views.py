from rest_framework import viewsets, permissions
from .models import Source, LeadDepartment, SubDepartment, Lead
from .serializers import (
    SourceSerializer, LeadDepartmentSerializer,
    SubDepartmentSerializer, LeadSerializer
)
from .permissions import IsAdminOrResponsiblePerson # <-- YANGI RUXSATNOMANI IMPORT QILAMIZ


class SourceViewSet(viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer
    permission_classes = [permissions.IsAuthenticated]

class LeadDepartmentViewSet(viewsets.ModelViewSet):
    queryset = LeadDepartment.objects.all()
    serializer_class = LeadDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

class SubDepartmentViewSet(viewsets.ModelViewSet):
    queryset = SubDepartment.objects.all()
    serializer_class = SubDepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    # Ruxsatnomani yangilaymiz
    permission_classes = [permissions.IsAuthenticated, IsAdminOrResponsiblePerson]

    def get_queryset(self):
        """
        Agar foydalanuvchi admin yoki staff bo'lsa, barcha lidlarni,
        aks holda faqat o'ziga tegishli lidlarni qaytaradi.
        """
        user = self.request.user
        queryset = Lead.objects.all()

        # Role-based filtering
        if user.is_superuser or user.is_staff:
            queryset = Lead.objects.all()
        else:
            queryset = Lead.objects.filter(responsible_person=user)

        # Date filtering - filter by created_at date
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(created_at__date=date_param)

        return queryset.select_related('source', 'department', 'sub_department', 'interested_course', 'branch', 'responsible_person').order_by('-created_at')

    def perform_create(self, serializer):
        """
        Yangi lid yaratilayotganda, unga mas'ul shaxs sifatida
        shu so'rovni yuborayotgan foydalanuvchini avtomatik tayinlaydi.
        """
        serializer.save(responsible_person=self.request.user)
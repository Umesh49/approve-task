from rest_framework import generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from accounts.permissions import IsAdmin

class AuditLogListView(generics.ListAPIView):
    """
    Exposes paginated, filterable audit logs. Restricted to Admin.
    Optimized with select_related('user') to prevent N+1 queries.
    """
    permission_classes = [IsAdmin]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all().order_by('-timestamp').select_related('user')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = {
        'user': ['exact'],
        'action': ['exact'],
        'entity_type': ['exact'],
        'entity_id': ['exact'],
        'timestamp': ['gte', 'lte'],
    }
    search_fields = ['description']

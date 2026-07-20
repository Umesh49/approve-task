from django_filters import rest_framework as filters
from approvals.models import ApprovalRequest

class ApprovalRequestFilter(filters.FilterSet):
    created_at_gte = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_at_lte = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = ApprovalRequest
        fields = ('status', 'workflow', 'submitted_by', 'priority', 'created_at_gte', 'created_at_lte')

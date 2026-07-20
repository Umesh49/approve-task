from django_filters import rest_framework as filters
from workflows.models import Workflow

class WorkflowFilter(filters.FilterSet):
    name = filters.CharFilter(lookup_expr='icontains')
    created_at_gte = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_at_lte = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = Workflow
        fields = ('is_published', 'created_by', 'name', 'created_at_gte', 'created_at_lte')

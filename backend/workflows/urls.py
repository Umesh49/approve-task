from django.urls import path
from workflows.views import (
    WorkflowViewSet,
    WorkflowStageViewSet,
    RuleViewSet
)

urlpatterns = [
    path('', WorkflowViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='workflow-list'),
    
    path('<uuid:pk>/', WorkflowViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='workflow-detail'),
    
    path('<uuid:pk>/publish/', WorkflowViewSet.as_view({
        'post': 'publish'
    }), name='workflow-publish'),
    
    path('<uuid:pk>/unpublish/', WorkflowViewSet.as_view({
        'post': 'unpublish'
    }), name='workflow-unpublish'),

    path('<uuid:pk>/sync/', WorkflowViewSet.as_view({
        'post': 'sync'
    }), name='workflow-sync'),

    path('<uuid:pk>/versions/', WorkflowViewSet.as_view({
        'get': 'versions_list'
    }), name='workflow-versions-list'),
    
    path('<uuid:pk>/versions/<uuid:version_id>/', WorkflowViewSet.as_view({
        'get': 'versions_detail'
    }), name='workflow-versions-detail'),
    
    path('<uuid:pk>/versions/<str:v1_id>/diff/<str:v2_id>/', WorkflowViewSet.as_view({
        'get': 'versions_diff'
    }), name='workflow-versions-diff'),

    path('<uuid:pk>/versions/<uuid:version_id>/restore/', WorkflowViewSet.as_view({
        'post': 'versions_restore'
    }), name='workflow-versions-restore'),

    path('<uuid:wf_id>/stages/', WorkflowStageViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='stage-list'),
    
    path('<uuid:wf_id>/stages/reorder/', WorkflowStageViewSet.as_view({
        'post': 'reorder'
    }), name='stage-reorder'),
    
    path('<uuid:wf_id>/stages/<uuid:pk>/', WorkflowStageViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='stage-detail'),

    path('<uuid:wf_id>/rules/', RuleViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='rule-list'),
    
    path('<uuid:wf_id>/rules/tree/', RuleViewSet.as_view({
        'get': 'tree'
    }), name='rule-tree'),
    
    path('<uuid:wf_id>/rules/<uuid:pk>/', RuleViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='rule-detail-nested'),
]

import datetime
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView
)
from workflows.views import RuleViewSet

def health_check(request):
    """
    Cold-start check endpoint. Returns 200 OK instantly with status and timestamp.
    No authentication or database query is performed to ensure speed.
    """
    return JsonResponse({
        "status": "ok",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "version": "1.0.0"
    })

urlpatterns = [
    path("admin/", admin.site.urls),
    
    path("api/health/", health_check, name="health_check"),
    
    path("api/auth/", include("accounts.urls")),
    
    path("api/workflows/", include("workflows.urls")),
    
    path("api/requests/", include("approvals.urls")),
    
    path("api/audit-logs/", include("audit.urls")),
    

    path("api/rules/<uuid:pk>/", RuleViewSet.as_view({
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name="rule-detail-standalone"),
    
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

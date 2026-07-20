from django.urls import path, include
from rest_framework.routers import SimpleRouter
from approvals.views import ApprovalRequestViewSet

router = SimpleRouter()
router.register('', ApprovalRequestViewSet, basename='request')

urlpatterns = [
    path('', include(router.urls)),
]

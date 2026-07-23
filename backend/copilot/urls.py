from django.urls import path
from copilot.views import ChatViewSet

urlpatterns = [
    path('chat/', ChatViewSet.as_view({'post': 'generate'}), name='copilot-chat'),
]

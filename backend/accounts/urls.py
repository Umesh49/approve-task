from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    UserListView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', LoginView.as_view(), name='auth_login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth_token_refresh'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('me/', MeView.as_view(), name='auth_me'),
    path('profile/', MeView.as_view(), name='auth_profile'),
    path('users/', UserListView.as_view(), name='auth_users'),
]

from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from accounts.models import User
from accounts.serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    UserListSerializer
)
from accounts.permissions import IsAdmin

class RegisterView(generics.CreateAPIView):
    """
    Registers a new user and returns their profile along with access and refresh tokens.
    """
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_201_CREATED)

class LoginView(generics.GenericAPIView):
    """
    Authenticates a user by email and password, returning tokens and user profile.
    """
    permission_classes = (permissions.AllowAny,)
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

class LogoutView(APIView):
    """
    Blacklists the provided refresh token to log out the user.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)
        except TokenError:
            return Response({"detail": "Token is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "An error occurred during logout."}, status=status.HTTP_400_BAD_REQUEST)

class MeView(generics.RetrieveAPIView):
    """
    Returns the profile data of the currently authenticated user.
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class UserListView(generics.ListAPIView):
    """
    Lists users. Only accessible by Admins (for filling dropdown fields, e.g., selecting specific approvers).
    Supports filtering by role using '?role=approver'.
    """
    permission_classes = (IsAdmin,)
    serializer_class = UserListSerializer
    queryset = User.objects.all().order_by('-created_at')

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        return queryset

import pytest
from rest_framework.test import APIClient
from accounts.models import User

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin_user",
        email="admin@example.com",
        password="adminpassword123",
        role=User.ROLE_ADMIN
    )

@pytest.fixture
def approver_user(db):
    return User.objects.create_user(
        username="approver_user",
        email="approver@example.com",
        password="approverpassword123",
        role=User.ROLE_APPROVER
    )

@pytest.fixture
def requester_user(db):
    return User.objects.create_user(
        username="requester_user",
        email="requester@example.com",
        password="requesterpassword123",
        role=User.ROLE_REQUESTER
    )

@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(admin_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client

@pytest.fixture
def approver_client(approver_user):
    client = APIClient()
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(approver_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client

@pytest.fixture
def requester_client(requester_user):
    client = APIClient()
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(requester_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client

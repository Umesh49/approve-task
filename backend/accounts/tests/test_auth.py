import pytest
from django.urls import reverse
from rest_framework import status
from accounts.models import User

@pytest.mark.django_db
def test_health_check(api_client):
    url = reverse('health_check')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data['status'] == 'ok'
    assert 'timestamp' in data
    assert data['version'] == '1.0.0'

@pytest.mark.django_db
def test_registration_success(api_client):
    url = reverse('auth_register')
    data = {
        "username": "new_user",
        "email": "new@example.com",
        "password": "password123",
        "password_confirm": "password123",
        "role": User.ROLE_REQUESTER,
        "first_name": "New",
        "last_name": "User"
    }
    response = api_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    resp_data = response.json()
    assert 'user' in resp_data
    assert resp_data['user']['username'] == 'new_user'
    assert resp_data['user']['email'] == 'new@example.com'
    assert resp_data['user']['role'] == User.ROLE_REQUESTER
    assert 'access' in resp_data
    assert 'refresh' in resp_data

@pytest.mark.django_db
def test_registration_password_mismatch(api_client):
    url = reverse('auth_register')
    data = {
        "username": "new_user",
        "email": "new@example.com",
        "password": "password123",
        "password_confirm": "password321",
        "role": User.ROLE_REQUESTER
    }
    response = api_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'password_confirm' in response.json()

@pytest.mark.django_db
def test_registration_email_duplicate(api_client, requester_user):
    url = reverse('auth_register')
    data = {
        "username": "another_user",
        "email": requester_user.email,  # duplicate email
        "password": "password123",
        "password_confirm": "password123",
        "role": User.ROLE_REQUESTER
    }
    response = api_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'email' in response.json()

@pytest.mark.django_db
def test_login_success(api_client, requester_user):
    url = reverse('auth_login')
    data = {
        "email": requester_user.email,
        "password": "requesterpassword123"
    }
    response = api_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_200_OK
    resp_data = response.json()
    assert 'user' in resp_data
    assert resp_data['user']['username'] == requester_user.username
    assert 'access' in resp_data
    assert 'refresh' in resp_data

@pytest.mark.django_db
def test_login_invalid_credentials(api_client, requester_user):
    url = reverse('auth_login')
    data = {
        "email": requester_user.email,
        "password": "wrongpassword"
    }
    response = api_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.django_db
def test_token_refresh(api_client, requester_user):
    login_url = reverse('auth_login')
    login_response = api_client.post(login_url, {
        "email": requester_user.email,
        "password": "requesterpassword123"
    }, format='json')
    
    refresh_token = login_response.json()['refresh']
    
    refresh_url = reverse('auth_token_refresh')
    response = api_client.post(refresh_url, {"refresh": refresh_token}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert 'access' in response.json()

@pytest.mark.django_db
def test_logout_success(api_client, requester_user):
    login_url = reverse('auth_login')
    login_response = api_client.post(login_url, {
        "email": requester_user.email,
        "password": "requesterpassword123"
    }, format='json')
    
    refresh_token = login_response.json()['refresh']
    access_token = login_response.json()['access']
    
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
    
    logout_url = reverse('auth_logout')
    response = api_client.post(logout_url, {"refresh": refresh_token}, format='json')
    assert response.status_code == status.HTTP_205_RESET_CONTENT

    refresh_url = reverse('auth_token_refresh')
    response = api_client.post(refresh_url, {"refresh": refresh_token}, format='json')
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
def test_me_authenticated(requester_client, requester_user):
    url = reverse('auth_me')
    response = requester_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data['username'] == requester_user.username
    assert data['email'] == requester_user.email

@pytest.mark.django_db
def test_me_unauthenticated(api_client):
    url = reverse('auth_me')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
def test_user_list_admin_only(admin_client, requester_client):
    url = reverse('auth_users')
    
    response = requester_client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    response = admin_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()['results']) > 0

@pytest.mark.django_db
def test_user_list_filtering(admin_client, approver_user, requester_user):
    url = reverse('auth_users')
    
    response = admin_client.get(url)
    all_users = response.json()['results']
    
    response = admin_client.get(f"{url}?role=approver")
    assert response.status_code == status.HTTP_200_OK
    approver_users = response.json()['results']
    
    assert len(approver_users) < len(all_users)
    for user in approver_users:
        assert user['role'] == User.ROLE_APPROVER

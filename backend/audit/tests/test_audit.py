import pytest
import uuid
from django.urls import reverse
from rest_framework import status
from audit.models import AuditLog

@pytest.mark.django_db
def test_audit_logs_rbac_and_filtering(admin_client, requester_client, admin_user):
    AuditLog.objects.create(
        user=admin_user,
        action="test_action_1",
        entity_type="workflow",
        entity_id=str(uuid.uuid4()),
        description="Admin test description 1"
    )
    AuditLog.objects.create(
        user=admin_user,
        action="test_action_2",
        entity_type="request",
        entity_id=str(uuid.uuid4()),
        description="Admin test description 2"
    )

    url = reverse('audit_log_list')

    response = requester_client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN

    response = admin_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert 'results' in data
    assert len(data['results']) >= 2

    response = admin_client.get(f"{url}?action=test_action_1")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()['results']) == 1
    assert response.json()['results'][0]['action'] == "test_action_1"

    response = admin_client.get(f"{url}?search=description 2")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()['results']) == 1
    assert "description 2" in response.json()['results'][0]['description']

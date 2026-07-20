import pytest
from django.urls import reverse
from rest_framework import status
from workflows.models import Workflow, WorkflowStage, Rule, WorkflowVersion

@pytest.mark.django_db
def test_workflow_crud_rbac(admin_client, requester_client):
    url = reverse('workflow-list')
    data = {"name": "New Workflow", "description": "Draft"}
    response = requester_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_403_FORBIDDEN

    response = admin_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    wf_id = response.json()['id']
    
    detail_url = reverse('workflow-detail', args=[wf_id])
    response = requester_client.get(detail_url)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['name'] == "New Workflow"

    response = requester_client.delete(detail_url)
    assert response.status_code == status.HTTP_403_FORBIDDEN

    response = admin_client.delete(detail_url)
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert Workflow.objects.get(id=wf_id).is_deleted is True

@pytest.mark.django_db
def test_workflow_publish_validation_and_versioning(admin_client, admin_user, approver_user):
    wf = Workflow.objects.create(name="Publish Test", created_by=admin_user)
    
    publish_url = reverse('workflow-publish', args=[wf.id])
    response = admin_client.post(publish_url, {"changelog": "First publish"}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "at least one stage" in response.json()['detail']

    stage = WorkflowStage.objects.create(
        workflow=wf,
        name="Stage 1",
        order=1,
        specific_approver=approver_user,
        stage_type="approval"
    )


    Rule.objects.create(
        workflow=wf,
        field_name="amount",
        operator="gt",
        value="1000",
        action="skip_stage",
        order=1
    )

    response = admin_client.post(publish_url, {"changelog": "Initial release"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    
    wf.refresh_from_db()
    assert wf.is_published is True
    assert wf.current_version == 1

    version = WorkflowVersion.objects.get(workflow=wf, version_number=1)
    assert version.is_active is True
    snapshot = version.snapshot
    assert len(snapshot['stages']) == 1
    assert snapshot['stages'][0]['name'] == "Stage 1"
    assert len(snapshot['rules']) == 1
    assert snapshot['rules'][0]['field_name'] == "amount"

    stage_detail_url = reverse('stage-detail', args=[wf.id, stage.id])
    response = admin_client.put(stage_detail_url, {"name": "Changed Name", "approver_role": "admin"}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "not allowed on a published workflow" in response.json()['detail']

    unpublish_url = reverse('workflow-unpublish', args=[wf.id])
    response = admin_client.post(unpublish_url, format='json')
    assert response.status_code == status.HTTP_200_OK
    wf.refresh_from_db()
    assert wf.is_published is False

    response = admin_client.patch(stage_detail_url, {"name": "Approved Stage"}, format='json')
    assert response.status_code == status.HTTP_200_OK

@pytest.mark.django_db
def test_stage_reordering(admin_client, admin_user, approver_user):
    wf = Workflow.objects.create(name="Reorder Test", created_by=admin_user)
    s1 = WorkflowStage.objects.create(workflow=wf, name="First", order=1, approver_role="admin")
    s2 = WorkflowStage.objects.create(workflow=wf, name="Second", order=2, approver_role="approver")
    s3 = WorkflowStage.objects.create(workflow=wf, name="Third", order=3, approver_role="requester")

    reorder_url = reverse('stage-reorder', args=[wf.id])
    
    new_order = [str(s3.id), str(s1.id), str(s2.id)]
    response = admin_client.post(reorder_url, {"stage_ids": new_order}, format='json')
    assert response.status_code == status.HTTP_200_OK

    s1.refresh_from_db()
    s2.refresh_from_db()
    s3.refresh_from_db()

    assert s3.order == 1
    assert s1.order == 2
    assert s2.order == 3


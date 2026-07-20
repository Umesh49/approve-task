import pytest
from django.urls import reverse
from rest_framework import status
from workflows.models import Workflow, WorkflowStage

@pytest.mark.django_db
def test_workflow_version_diff_api(admin_client, admin_user, approver_user):
    wf = Workflow.objects.create(name="Diff Test Workflow", created_by=admin_user)
    
    s1 = WorkflowStage.objects.create(
        workflow=wf, name="Initial Stage", order=1, specific_approver=approver_user
    )

    
    publish_url = reverse('workflow-publish', args=[wf.id])
    res1 = admin_client.post(publish_url, {"changelog": "V1 snapshot"}, format='json')
    assert res1.status_code == status.HTTP_200_OK
    v1_id = wf.versions.get(version_number=1).id

    unpublish_url = reverse('workflow-unpublish', args=[wf.id])
    admin_client.post(unpublish_url, format='json')

    # - Modify s1 name
    # - Add a new stage s2
    # - Delete field f1
    # - Add a new field f2
    s1.name = "Updated Stage Name"
    s1.save()
    
    WorkflowStage.objects.create(
        workflow=wf, name="Second Stage", order=2, approver_role="approver"
    )


    res2 = admin_client.post(publish_url, {"changelog": "V2 snapshot"}, format='json')
    assert res2.status_code == status.HTTP_200_OK
    v2_id = wf.versions.get(version_number=2).id

    diff_url = reverse('workflow-versions-diff', args=[wf.id, v1_id, v2_id])
    response = admin_client.get(diff_url)
    assert response.status_code == status.HTTP_200_OK
    diff = response.json()

    stages_diff = diff['stages']
    assert len(stages_diff['added']) == 1
    assert stages_diff['added'][0]['name'] == "Second Stage"
    
    assert len(stages_diff['modified']) == 1
    assert stages_diff['modified'][0]['new']['name'] == "Updated Stage Name"
    assert stages_diff['modified'][0]['old']['name'] == "Initial Stage"
    
    assert len(stages_diff['removed']) == 0


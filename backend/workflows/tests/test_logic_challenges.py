import pytest
from django.urls import reverse
from rest_framework import status
from workflows.models import Workflow, WorkflowStage, Rule
from approvals.models import ApprovalRequest

@pytest.mark.django_db
def test_circular_workflow_prevented(admin_client, admin_user, approver_user):
    wf = Workflow.objects.create(name="Circular WF", created_by=admin_user)
    s1 = WorkflowStage.objects.create(workflow=wf, name="S1", order=1, specific_approver=approver_user)
    s2 = WorkflowStage.objects.create(workflow=wf, name="S2", order=2, specific_approver=approver_user)

    
    Rule.objects.create(
        workflow=wf, stage=s2, field_name="amount", operator="gt", value="100", 
        action="route_to", action_target={"stage_id": str(s1.id)}, order=1
    )
    
    url = reverse('workflow-publish', args=[wf.id])
    response = admin_client.post(url, {"changelog": "V1"}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Circular workflow detected" in response.json()['detail']

@pytest.mark.django_db
def test_duplicate_stage_name_prevented(admin_client, admin_user):
    wf = Workflow.objects.create(name="Duplicate Stage WF", created_by=admin_user)
    
    url = reverse('stage-list', args=[wf.id])
    data1 = {"name": "Review", "stage_type": "approval", "approver_role": "manager"}
    admin_client.post(url, data1, format='json')
    
    data2 = {"name": "Review", "stage_type": "approval", "approver_role": "admin"}
    response = admin_client.post(url, data2, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in str(response.json())

@pytest.mark.django_db
def test_invalid_publications_prevented(admin_client, admin_user):
    wf = Workflow.objects.create(name="Invalid Pub WF", created_by=admin_user)
    WorkflowStage.objects.create(workflow=wf, name="S1", order=1, approver_role="admin")
    
    Rule.objects.create(
        workflow=wf, field_name="fake_field", operator="eq", value="1", 
        action="route_to", action_target={"stage_id": "00000000-0000-0000-0000-000000000000"}, order=1
    )
    
    url = reverse('workflow-publish', args=[wf.id])
    response = admin_client.post(url, {"changelog": "V1"}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Routing target" in response.json()['detail']

@pytest.mark.django_db
def test_infinite_loop_runtime_prevention(requester_client, approver_client, admin_user, approver_user):
    wf = Workflow.objects.create(name="Loop WF", created_by=admin_user)
    s1 = WorkflowStage.objects.create(workflow=wf, name="S1", order=1, specific_approver=approver_user)
    s2 = WorkflowStage.objects.create(workflow=wf, name="S2", order=2, specific_approver=approver_user)

    
    # (assuming it's a dynamic loop or we just force it in DB)
    Rule.objects.create(
        workflow=wf, stage=s2, field_name="amount", operator="gt", value="100", 
        action="route_to", action_target={"stage_id": str(s1.id)}, order=1
    )
    wf.is_published = True
    wf.current_version = 1
    wf.save()
    from workflows.models import WorkflowVersion
    wv = WorkflowVersion.objects.create(workflow=wf, version_number=1, snapshot={"stages": [{"id": str(s1.id)}, {"id": str(s2.id)}]}, published_by=admin_user)
    
    req_obj = ApprovalRequest.objects.create(
        title="Loop Req", workflow=wf, workflow_version=wv, submitted_by=admin_user, data={"amount": 200}, status=ApprovalRequest.STATUS_IN_PROGRESS
    )
    from approvals.models import StageExecution
    StageExecution.objects.create(request=req_obj, stage=s1, stage_order=1, status='pending', assigned_to=approver_user)
    StageExecution.objects.create(request=req_obj, stage=s2, stage_order=2, status='pending', assigned_to=approver_user)
    req_obj.current_stage = s1
    req_obj.save()
    
    url1 = reverse('request-approve', args=[req_obj.id])
    approver_client.post(url1, {"comments": "ok"}, format='json')
    req_obj.refresh_from_db()
    assert req_obj.current_stage == s2
    
    url2 = reverse('request-approve', args=[req_obj.id])
    res = approver_client.post(url2, {"comments": "ok"}, format='json')
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "visited twice" in res.json()['detail']
    
    req_obj.refresh_from_db()
    assert req_obj.status == 'terminated'

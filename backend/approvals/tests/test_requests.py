import pytest
from django.urls import reverse
from rest_framework import status
from accounts.models import User
from workflows.models import Workflow, WorkflowStage, Rule, WorkflowVersion
from approvals.models import ApprovalRequest, StageExecution

@pytest.fixture
def setup_workflow(db, admin_user, approver_user, requester_user):
    approver2 = User.objects.create_user(
        username="approver2_user",
        email="approver2@example.com",
        password="approverpassword123",
        role=User.ROLE_APPROVER
    )
    
    wf = Workflow.objects.create(name="Purchase Request", created_by=admin_user)
    

    s1 = WorkflowStage.objects.create(
        workflow=wf,
        name="Manager Approval",
        order=1,
        specific_approver=approver_user,
        stage_type="approval"
    )
    s2 = WorkflowStage.objects.create(
        workflow=wf,
        name="VP Review",
        order=2,
        approver_role=User.ROLE_APPROVER,
        stage_type="approval"
    )
    s3 = WorkflowStage.objects.create(
        workflow=wf,
        name="CFO Approval",
        order=3,
        specific_approver=approver2,
        stage_type="approval"
    )
    
    Rule.objects.create(
        workflow=wf,
        stage=s2,
        field_name="amount",
        operator="lt",
        value="5000",
        action="skip_stage",
        action_target={"stage_id": str(s2.id)},
        order=1
    )
    
    
    stages_data = [
        {"id": str(s1.id), "name": s1.name, "order": s1.order, "specific_approver": str(s1.specific_approver.id), "stage_type": s1.stage_type},
        {"id": str(s2.id), "name": s2.name, "order": s2.order, "approver_role": s2.approver_role, "stage_type": s2.stage_type},
        {"id": str(s3.id), "name": s3.name, "order": s3.order, "specific_approver": str(s3.specific_approver.id), "stage_type": s3.stage_type}
    ]
    snapshot = {"stages": stages_data, "rules": []}
    
    WorkflowVersion.objects.create(
        workflow=wf,
        version_number=1,
        snapshot=snapshot,
        published_by=admin_user,
        is_active=True
    )
    wf.is_published = True
    wf.current_version = 1
    wf.save()
    
    return {
        "workflow": wf,
        "stages": [s1, s2, s3],
        "approver2": approver2
    }

@pytest.mark.django_db
def test_request_submission_validation(requester_client, setup_workflow):
    wf = setup_workflow['workflow']
    url = reverse('request-list')
    
    data = {
        "title": "Valid Low Amount Request",
        "workflow": str(wf.id),
        "data": {"amount": 3000, "department": "IT"},
        "priority": "low"
    }
    response = requester_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    resp_data = response.json()
    assert resp_data['status'] == ApprovalRequest.STATUS_IN_PROGRESS
    
    req_id = resp_data['id']
    req_obj = ApprovalRequest.objects.get(id=req_id)
    
    execs = req_obj.stage_executions.all().order_by('stage_order')
    assert execs.count() == 3
    assert execs[0].status == StageExecution.STATUS_PENDING  # Manager Approval
    assert execs[1].status == StageExecution.STATUS_SKIPPED  # VP Review (skipped since amount < 5000!)
    assert execs[2].status == StageExecution.STATUS_PENDING  # CFO Approval

    assert req_obj.current_stage == setup_workflow['stages'][0]

@pytest.mark.django_db
def test_role_based_request_filtering(requester_client, approver_client, admin_client, setup_workflow):
    wf = setup_workflow['workflow']
    url = reverse('request-list')
    
    data = {
        "title": "Requester Request",
        "workflow": str(wf.id),
        "data": {"amount": 3000, "department": "IT"}
    }
    response = requester_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    
    response = requester_client.get(url)
    assert len(response.json()['results']) == 1

    response = approver_client.get(url)
    assert len(response.json()['results']) == 1

    response = admin_client.get(url)
    assert len(response.json()['results']) == 1

@pytest.mark.django_db
def test_approval_and_timeline_flow(requester_client, approver_client, admin_client, setup_workflow):
    wf = setup_workflow['workflow']
    setup_workflow['stages']
    approver2 = setup_workflow['approver2']
    
    submit_url = reverse('request-list')
    data = {
        "title": "Low Purchase",
        "workflow": str(wf.id),
        "data": {"amount": 2000, "department": "HR"}
    }
    response = requester_client.post(submit_url, data, format='json')
    req_id = response.json()['id']

    approve_url = reverse('request-approve', args=[req_id])
    response = approver_client.post(approve_url, {"comments": "Looks good"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['current_stage_name'] == "CFO Approval"  # Shipped past skipped VP Review to CFO!

    timeline_url = reverse('request-timeline', args=[req_id])
    response = requester_client.get(timeline_url)
    assert response.status_code == status.HTTP_200_OK
    timeline = response.json()
    assert timeline[0]['status'] == StageExecution.STATUS_APPROVED
    assert timeline[0]['comments'] == "Looks good"
    assert timeline[1]['status'] == StageExecution.STATUS_SKIPPED
    assert timeline[2]['status'] == StageExecution.STATUS_PENDING

    cfo_client = requester_client  # re-use requester_client but with cfo token
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(approver2)
    cfo_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    response = cfo_client.post(approve_url, {"comments": "Approved budget"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['status'] == ApprovalRequest.STATUS_APPROVED
    assert response.json()['current_stage'] is None

@pytest.mark.django_db
def test_rejection_flow(requester_client, approver_client, setup_workflow):
    wf = setup_workflow['workflow']
    
    submit_url = reverse('request-list')
    data = {
        "title": "Rejected Purchase",
        "workflow": str(wf.id),
        "data": {"amount": 2000, "department": "HR"}
    }
    response = requester_client.post(submit_url, data, format='json')
    req_id = response.json()['id']

    reject_url = reverse('request-reject', args=[req_id])
    response = approver_client.post(reject_url, {"comments": ""}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'comments' in response.json()

    response = approver_client.post(reject_url, {"comments": "Too expensive"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['status'] == ApprovalRequest.STATUS_REJECTED
    assert response.json()['current_stage'] is None

@pytest.mark.django_db
def test_rollback_types(requester_client, approver_client, admin_client, setup_workflow):
    wf = setup_workflow['workflow']
    setup_workflow['approver2']
    
    submit_url = reverse('request-list')
    data = {
        "title": "Rollback Test Purchase",
        "workflow": str(wf.id),
        "data": {"amount": 2000, "department": "HR"}
    }
    response = requester_client.post(submit_url, data, format='json')
    req_id = response.json()['id']

    approve_url = reverse('request-approve', args=[req_id])
    approver_client.post(approve_url, {"comments": "First stage approve"}, format='json')

    rollback_url = reverse('request-rollback', args=[req_id])
    response = requester_client.post(rollback_url, {"type": "previous_step"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['current_stage_name'] == "Manager Approval"
    
    approver_client.post(approve_url, {"comments": "First stage re-approve"}, format='json')

    response = requester_client.post(rollback_url, {"type": "beginning"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['current_stage_name'] == "Manager Approval"

    response = requester_client.post(rollback_url, {"type": "terminate"}, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['status'] == ApprovalRequest.STATUS_TERMINATED
    assert response.json()['current_stage'] is None

@pytest.mark.django_db
def test_concurrency_conflict_handling(requester_client, approver_client, setup_workflow):
    wf = setup_workflow['workflow']
    
    submit_url = reverse('request-list')
    data = {
        "title": "Concurrency Purchase",
        "workflow": str(wf.id),
        "data": {"amount": 2000, "department": "HR"}
    }
    response = requester_client.post(submit_url, data, format='json')
    req_id = response.json()['id']

    stage_id = response.json()['current_stage']

    approve_url = reverse('request-approve', args=[req_id])
    response1 = approver_client.post(approve_url, {"comments": "First call", "stage_id": stage_id}, format='json')
    assert response1.status_code == status.HTTP_200_OK

    response2 = approver_client.post(approve_url, {"comments": "Concurrent second call", "stage_id": stage_id}, format='json')
    assert response2.status_code == status.HTTP_409_CONFLICT

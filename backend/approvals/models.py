import uuid
from django.db import models
from django.conf import settings
from workflows.models import Workflow, WorkflowVersion, WorkflowStage

class ApprovalRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_TERMINATED = 'terminated'
    STATUS_ROLLED_BACK = 'rolled_back'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_TERMINATED, 'Terminated'),
        (STATUS_ROLLED_BACK, 'Rolled Back'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH = 'high'
    PRIORITY_CRITICAL = 'critical'

    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_MEDIUM, 'Medium'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_CRITICAL, 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    workflow = models.ForeignKey(Workflow, on_delete=models.PROTECT, related_name='requests')
    workflow_version = models.ForeignKey(WorkflowVersion, on_delete=models.PROTECT, related_name='requests')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='requests_submitted'
    )
    data = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    current_stage = models.ForeignKey(
        WorkflowStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_requests'
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.status}"

class StageExecution(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_SKIPPED = 'skipped'
    STATUS_ROLLED_BACK = 'rolled_back'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_SKIPPED, 'Skipped'),
        (STATUS_ROLLED_BACK, 'Rolled Back'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(ApprovalRequest, on_delete=models.CASCADE, related_name='stage_executions')
    stage = models.ForeignKey(WorkflowStage, on_delete=models.PROTECT, related_name='stage_executions')
    stage_order = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_executions'
    )
    acted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acted_executions'
    )
    comments = models.TextField(blank=True, default='')
    acted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    skipped_reason = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['stage_order']

    def __str__(self):
        return f"Stage {self.stage.name} - {self.status} for Request {self.request.title}"

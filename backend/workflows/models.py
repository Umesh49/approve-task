import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='workflows_created'
    )
    is_published = models.BooleanField(default=False)
    current_version = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def delete(self, using=None, keep_parents=False):
        """Soft delete the workflow."""
        self.is_deleted = True
        self.save()

    def __str__(self):
        return self.name

class WorkflowVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    snapshot = models.JSONField()
    changelog = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(auto_now_add=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='published_versions'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-version_number']

    def save(self, *args, **kwargs):
        if self.is_active:
            WorkflowVersion.objects.filter(workflow=self.workflow, is_active=True).exclude(id=self.id).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.workflow.name} v{self.version_number}"

class WorkflowStage(models.Model):
    STAGE_TYPE_CHOICES = [
        ('approval', 'Approval'),
        ('review', 'Review'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='stages')
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField()
    approver_role = models.CharField(max_length=20, null=True, blank=True)
    specific_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='assigned_stages'
    )
    stage_type = models.CharField(max_length=20, choices=STAGE_TYPE_CHOICES, default='approval')
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = (('workflow', 'name'), ('workflow', 'order'))
        ordering = ['order']

    def clean(self):
        super().clean()
        if not self.approver_role and not self.specific_approver:
            raise ValidationError("Either approver_role or specific_approver must be set.")
        if self.specific_approver and not self.specific_approver.is_active:
            raise ValidationError({"specific_approver": "The assigned specific approver must be active."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (Stage {self.order}) in {self.workflow.name}"

class Rule(models.Model):
    LOGICAL_OPERATOR_CHOICES = [
        ('AND', 'AND'),
        ('OR', 'OR'),
    ]

    OPERATOR_CHOICES = [
        ('gt', 'Greater Than'),
        ('lt', 'Less Than'),
        ('eq', 'Equals'),
        ('neq', 'Not Equals'),
        ('gte', 'Greater Than or Equal'),
        ('lte', 'Less Than or Equal'),
        ('in', 'In'),
        ('not_in', 'Not In'),
    ]

    ACTION_CHOICES = [
        ('skip_stage', 'Skip Stage'),
        ('add_approval', 'Add Approval'),
        ('route_to', 'Route To'),
        ('terminate', 'Terminate'),
        ('none', 'None'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='rules')
    stage = models.ForeignKey(
        WorkflowStage,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='rules'
    )
    parent_rule = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )
    logical_operator = models.CharField(
        max_length=3,
        choices=LOGICAL_OPERATOR_CHOICES,
        null=True,
        blank=True
    )
    field_name = models.CharField(max_length=100, null=True, blank=True)
    operator = models.CharField(
        max_length=10,
        choices=OPERATOR_CHOICES,
        null=True,
        blank=True
    )
    value = models.CharField(max_length=500, null=True, blank=True)
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        default='none'
    )
    action_target = models.JSONField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def clean(self):
        super().clean()
        if self.logical_operator:
            if self.field_name or self.operator or self.value:
                raise ValidationError("Group node cannot define field_name, operator, or value.")
        else:
            if not self.field_name or not self.operator or self.value is None:
                raise ValidationError("Leaf node must specify field_name, operator, and value.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.logical_operator:
            return f"Group ({self.logical_operator}) - Workflow {self.workflow.name}"
        return f"Condition ({self.field_name} {self.operator} {self.value}) - Action: {self.action}"

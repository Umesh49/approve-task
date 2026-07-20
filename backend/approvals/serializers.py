import datetime
from rest_framework import serializers
from approvals.models import ApprovalRequest, StageExecution

class StageExecutionSerializer(serializers.ModelSerializer):
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    acted_by_username = serializers.CharField(source='acted_by.username', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)

    class Meta:
        model = StageExecution
        fields = ('id', 'request', 'stage', 'stage_name', 'stage_order', 'status', 'assigned_to', 'assigned_to_username', 'acted_by', 'acted_by_username', 'comments', 'acted_at', 'created_at', 'skipped_reason')
        read_only_fields = ('id', 'request', 'stage', 'stage_order', 'status', 'assigned_to', 'acted_by', 'acted_at', 'created_at', 'skipped_reason')

class ApprovalRequestSerializer(serializers.ModelSerializer):
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    current_stage_name = serializers.CharField(source='current_stage.name', read_only=True)
    stage_executions = StageExecutionSerializer(many=True, read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    is_actionable = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = ('id', 'title', 'workflow', 'workflow_name', 'workflow_version', 'submitted_by', 'submitted_by_username', 'data', 'status', 'current_stage', 'current_stage_name', 'priority', 'created_at', 'updated_at', 'stage_executions', 'is_actionable')
        read_only_fields = ('id', 'workflow_version', 'submitted_by', 'status', 'current_stage', 'created_at', 'updated_at', 'stage_executions', 'is_actionable')

    def get_is_actionable(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        
        if obj.status != 'in_progress':
            return False
            
        stage = obj.current_stage
        if not stage:
            return False
            
        user = request.user
        if stage.specific_approver_id == user.id:
            return True
        if stage.approver_role and stage.approver_role == user.role:
            return True
        return False

def validate_dynamic_form_data(workflow_version, data):
    """
    Validates that the submitted form data complies with the fields defined in the
    published workflow version snapshot.
    """
    snapshot = workflow_version.snapshot
    fields = snapshot.get('fields', [])
    
    errors = {}
    for f in fields:
        name = f['field_name']
        label = f['field_label']
        f_type = f['field_type']
        is_required = f.get('is_required', True)
        options = f.get('options')
        validation_rules = f.get('validation_rules') or {}
        
        val = data.get(name)
        
        if val is None or val == '':
            if is_required:
                errors[name] = f"Field '{label}' is required."
            continue
            
        if f_type == 'number':
            try:
                num_val = float(val)
                min_val = validation_rules.get('min')
                max_val = validation_rules.get('max')
                if min_val is not None and num_val < float(min_val):
                    errors[name] = f"Field '{label}' must be at least {min_val}."
                if max_val is not None and num_val > float(max_val):
                    errors[name] = f"Field '{label}' must be at most {max_val}."
            except (ValueError, TypeError):
                errors[name] = f"Field '{label}' must be a valid number."
        elif f_type == 'boolean':
            if not isinstance(val, bool) and str(val).lower() not in ('true', 'false'):
                errors[name] = f"Field '{label}' must be a boolean."
        elif f_type == 'select':
            if options and val not in options:
                errors[name] = f"Field '{label}' must be one of {options}."
        elif f_type == 'date':
            try:
                datetime.datetime.strptime(str(val), '%Y-%m-%d')
            except ValueError:
                errors[name] = f"Field '{label}' must be a valid ISO date (YYYY-MM-DD)."
                
    if errors:
        raise serializers.ValidationError(errors)

class ApprovalRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRequest
        fields = ('id', 'title', 'workflow', 'data', 'priority', 'status', 'current_stage', 'created_at')
        read_only_fields = ('id', 'status', 'current_stage', 'created_at')

    def validate_workflow(self, value):
        if not value.is_published:
            raise serializers.ValidationError("Cannot submit request. The selected workflow is not published.")
        return value

    def validate(self, attrs):
        workflow = attrs.get('workflow')
        data = attrs.get('data', {})
        
        active_version = workflow.versions.filter(is_active=True).first()
        if not active_version:
            raise serializers.ValidationError({"workflow": "No active version found for the published workflow."})
            
        validate_dynamic_form_data(active_version, data)
        
        attrs['workflow_version'] = active_version
        return attrs


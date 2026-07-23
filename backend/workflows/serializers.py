from rest_framework import serializers
from workflows.models import Workflow, WorkflowVersion, WorkflowStage, Rule

class WorkflowStageSerializer(serializers.ModelSerializer):
    approver_type = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowStage
        fields = ('id', 'workflow', 'name', 'order', 'approver_role', 'specific_approver', 'stage_type', 'config', 'approver_type')
        read_only_fields = ('id', 'workflow', 'order')

    def get_approver_type(self, obj):
        return 'user' if obj.specific_approver else 'role'

    def validate_name(self, value):
        view = self.context.get('view')
        if view and hasattr(view, 'kwargs') and 'wf_id' in view.kwargs:
            workflow_id = view.kwargs['wf_id']
            qs = WorkflowStage.objects.filter(workflow_id=workflow_id, name=value)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("A stage with this name already exists in the workflow.")
        return value

    def validate(self, attrs):
        approver_role = attrs.get('approver_role')
        specific_approver = attrs.get('specific_approver')

        if self.instance:
            approver_role = attrs.get('approver_role', self.instance.approver_role)
            specific_approver = attrs.get('specific_approver', self.instance.specific_approver)

        if not approver_role and not specific_approver:
            raise serializers.ValidationError("Either approver_role or specific_approver must be set.")
        if specific_approver and not specific_approver.is_active:
            raise serializers.ValidationError({"specific_approver": "The assigned specific approver must be active."})
        return attrs


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = ('id', 'workflow', 'stage', 'parent_rule', 'logical_operator', 'field_name', 'operator', 'value', 'action', 'action_target', 'order')
        read_only_fields = ('id', 'workflow')

    def validate(self, attrs):
        logical_operator = attrs.get('logical_operator')
        field_name = attrs.get('field_name')
        operator = attrs.get('operator')
        value = attrs.get('value')
        action = attrs.get('action')

        if self.instance:
            logical_operator = attrs.get('logical_operator', self.instance.logical_operator)
            field_name = attrs.get('field_name', self.instance.field_name)
            operator = attrs.get('operator', self.instance.operator)
            value = attrs.get('value', self.instance.value)
            action = attrs.get('action', self.instance.action)

        if logical_operator:
            if field_name or operator or value is not None:
                raise serializers.ValidationError("Group node cannot define field_name, operator, or value.")
        else:
            if not action and (not field_name or not operator or value is None):
                raise serializers.ValidationError("Leaf node must specify either an action (for unconditional routing) or field_name, operator, and value (for conditional routing).")
        return attrs

class RuleTreeSerializer(serializers.ModelSerializer):
    field_id = serializers.CharField(source='field_name', read_only=True)
    target_stage_id = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Rule
        fields = ('id', 'logical_operator', 'field_name', 'field_id', 'operator', 'value', 'action', 'action_target', 'target_stage_id', 'order', 'children')

    def get_target_stage_id(self, obj):
        if obj.action_target and isinstance(obj.action_target, dict):
            return obj.action_target.get('stage_id')
        return None

    def get_children(self, obj):
        if obj.logical_operator:
            children = obj.children.all().order_by('order')
            return RuleTreeSerializer(children, many=True).data
        return []

class WorkflowListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Workflow
        fields = ('id', 'name', 'description', 'created_by', 'created_by_username', 'is_published', 'current_version', 'created_at', 'updated_at')

class WorkflowDetailSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    stages = WorkflowStageSerializer(many=True, read_only=True)
    rules = serializers.SerializerMethodField()
    class Meta:
        model = Workflow
        fields = ('id', 'name', 'description', 'created_by', 'created_by_username', 'is_published', 'current_version', 'created_at', 'updated_at', 'stages', 'rules')

    def get_rules(self, obj):
        root_rules = obj.rules.filter(parent_rule=None).order_by('order')
        return RuleTreeSerializer(root_rules, many=True).data

class WorkflowCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workflow
        fields = ('id', 'name', 'description')
        read_only_fields = ('id',)

class WorkflowVersionSerializer(serializers.ModelSerializer):
    published_by_username = serializers.CharField(source='published_by.username', read_only=True)
    class Meta:
        model = WorkflowVersion
        fields = ('id', 'workflow', 'version_number', 'changelog', 'published_at', 'published_by', 'published_by_username', 'is_active', 'snapshot')


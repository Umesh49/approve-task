from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import IsAdmin, IsAdminOrReadOnly
from audit.utils import create_audit_log, make_json_safe
from workflows.models import Workflow, WorkflowStage, Rule, WorkflowVersion
from workflows.filters import WorkflowFilter
from workflows.serializers import (
    WorkflowListSerializer,
    WorkflowDetailSerializer,
    WorkflowCreateUpdateSerializer,
    WorkflowStageSerializer,
    RuleSerializer,
    RuleTreeSerializer,
    WorkflowVersionSerializer
)

def get_active_workflow_or_404(wf_id):
    return get_object_or_404(Workflow, id=wf_id, is_deleted=False)

def check_workflow_not_published(workflow):
    if workflow.is_published:
        raise ValidationError({"detail": "This operation is not allowed on a published workflow. Please unpublish first."})

def diff_snapshots(s1, s2):
    if not s1:
        s1 = {}
    if not s2:
        s2 = {}

    def get_diff_for_key(key, identity_field):
        list1 = s1.get(key, [])
        list2 = s2.get(key, [])
        
        map1 = {str(item[identity_field]): item for item in list1 if identity_field in item}
        map2 = {str(item[identity_field]): item for item in list2 if identity_field in item}
        
        added = []
        removed = []
        modified = []
        
        for ident, item2 in map2.items():
            if ident not in map1:
                added.append(item2)
            else:
                item1 = map1[ident]
                if item1 != item2:
                    modified.append({"old": item1, "new": item2})
                    
        for ident, item1 in map1.items():
            if ident not in map2:
                removed.append(item1)
                
        return {"added": added, "removed": removed, "modified": modified}
        
    return {
        "stages": get_diff_for_key("stages", "id"),
        "rules": get_diff_for_key("rules", "id")
    }

class WorkflowViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workflow CRUD operations.
    Write operations restricted to Admin. Read is allowed for Authenticated users.
    Soft deletes workflows by setting is_deleted=True.
    """
    permission_classes = [IsAdminOrReadOnly]
    queryset = Workflow.objects.filter(is_deleted=False).prefetch_related('stages', 'versions').order_by('-created_at')
    filterset_class = WorkflowFilter
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkflowListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WorkflowCreateUpdateSerializer
        return WorkflowDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        from django.core.cache import cache
        instance = self.get_object()
        
        cache_key = f"wf_detail_{instance.id}_{instance.updated_at.timestamp()}"
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        serializer = self.get_serializer(instance)
        cache.set(cache_key, serializer.data, timeout=60 * 60)
        return Response(serializer.data)

    def perform_create(self, serializer):
        from django.utils import timezone
        default_name = f"New Workflow {timezone.now().strftime('%b %d, %H:%M')}"
        instance = serializer.save(created_by=self.request.user, name=serializer.validated_data.get('name', default_name))
        create_audit_log(
            self.request.user,
            'workflow_created',
            'workflow',
            instance.id,
            new_value=WorkflowListSerializer(instance).data,
            request=self.request
        )

    def perform_update(self, serializer):
        workflow = serializer.instance
        check_workflow_not_published(workflow)
        old_data = WorkflowDetailSerializer(workflow).data
        instance = serializer.save()
        create_audit_log(
            self.request.user,
            'workflow_updated',
            'workflow',
            instance.id,
            old_value=old_data,
            new_value=WorkflowDetailSerializer(instance).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        create_audit_log(
            self.request.user,
            'workflow_deleted',
            'workflow',
            instance.id,
            old_value=WorkflowDetailSerializer(instance).data,
            request=self.request
        )
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    @transaction.atomic
    def sync(self, request, pk=None):
        workflow = self.get_object()
        check_workflow_not_published(workflow)
        
        workflow.name = request.data.get('name', workflow.name)
        workflow.description = request.data.get('description', workflow.description)
        workflow.save()

        stages_data = request.data.get('stages', [])
        rules_data = request.data.get('rules', [])
        
        id_map = {}  # Map frontend temporary stage IDs to backend UUIDs
        
        import uuid
        incoming_stage_ids = []
        for s in stages_data:
            sid = s.get('id')
            if sid and not str(sid).startswith('wf-') and not str(sid).startswith('st-'):
                try:
                    uuid.UUID(str(sid))
                    incoming_stage_ids.append(str(sid))
                except ValueError:
                    pass
        
        from django.db.models import ProtectedError
        try:
            workflow.stages.exclude(id__in=incoming_stage_ids).delete()
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete stages that have running requests linked to them. Please keep the stages or create a new workflow."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for idx, stage in enumerate(stages_data):
            from accounts.models import User
            frontend_id = stage.get('id')
            approver_type = stage.get('approver_type')
            specific_approver_id = stage.get('specific_approver')
            approver_role_val = stage.get('approver_role', '')

            approver_user = None
            final_approver_role = ''

            if approver_type == 'user' or (not approver_type and specific_approver_id):
                if specific_approver_id:
                    try:
                        approver_user = User.objects.get(id=specific_approver_id)
                    except User.DoesNotExist:
                        pass
            else:
                final_approver_role = approver_role_val or 'approver'

            if not approver_user and not final_approver_role:
                final_approver_role = 'approver'

            is_new = not frontend_id or str(frontend_id).startswith('wf-') or str(frontend_id).startswith('st-')
            
            if not is_new:
                try:
                    new_stage = WorkflowStage.objects.get(id=frontend_id)
                    new_stage.name = stage.get('name', '')
                    new_stage.order = idx + 1
                    new_stage.approver_role = final_approver_role
                    new_stage.specific_approver = approver_user
                    new_stage.stage_type = stage.get('stage_type', 'approval')
                    new_stage.save()
                    id_map[str(frontend_id)] = str(new_stage.id)
                except WorkflowStage.DoesNotExist:
                    is_new = True
                    
            if is_new:
                new_stage = WorkflowStage.objects.create(
                    workflow=workflow,
                    name=stage.get('name', ''),
                    order=idx + 1,
                    approver_role=final_approver_role,
                    specific_approver=approver_user,
                    stage_type=stage.get('stage_type', 'approval')
                )
                if frontend_id:
                    id_map[str(frontend_id)] = str(new_stage.id)

        workflow.rules.all().delete()
        
        def create_rule(rule_data, parent_rule=None, order=0):
            logical_operator = rule_data.get('logical_operator')
            
            action_target_data = rule_data.get('action_target') or {}
            target_id = rule_data.get('target_stage_id') or action_target_data.get('stage_id')
            mapped_target_id = id_map.get(str(target_id), target_id) if target_id else None
            action_target = {'stage_id': mapped_target_id} if mapped_target_id else None
            
            if logical_operator:
                rule_obj = Rule.objects.create(
                    workflow=workflow,
                    parent_rule=parent_rule,
                    logical_operator=logical_operator,
                    action=rule_data.get('action', 'none'),
                    action_target=action_target,
                    order=order
                )
                children = rule_data.get('children', [])
                for child_idx, child in enumerate(children):
                    create_rule(child, parent_rule=rule_obj, order=child_idx + 1)
                return rule_obj
            else:
                field_name = rule_data.get('field_id', '') or rule_data.get('field_name', '')

                return Rule.objects.create(
                    workflow=workflow,
                    parent_rule=parent_rule,
                    field_name=field_name,
                    operator=rule_data.get('operator', 'eq'),
                    value=str(rule_data.get('value', '')),
                    action=rule_data.get('action', 'none'),
                    action_target=action_target,
                    order=order
                )

        for idx, rule_data in enumerate(rules_data):
            create_rule(rule_data, order=idx + 1)

        return Response(WorkflowDetailSerializer(workflow).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    @transaction.atomic
    def publish(self, request, pk=None):
        """
        Validates the workflow and snapshots its stages and rules.
        Increments current_version, sets is_published=True.
        """
        workflow = self.get_object()
        stages = workflow.stages.all().order_by('order')
        if not stages.exists():
            return Response(
                {"detail": "Workflow must have at least one stage to be published."},
                status=status.HTTP_400_BAD_REQUEST
            )

        stage_ids = [str(stage.id) for stage in stages]
        rules = workflow.rules.all()
        for rule in rules:
            if rule.action == 'route_to':
                target_id = rule.action_target.get('stage_id') if rule.action_target else None
                if not target_id or str(target_id) not in stage_ids:
                    return Response(
                        {"detail": f"Routing target '{target_id}' does not exist."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        graph = {str(stage.id): [] for stage in stages}
        
        stages_list = list(stages)
        for i in range(len(stages_list) - 1):
            graph[str(stages_list[i].id)].append(str(stages_list[i+1].id))

        for rule in rules:
            if rule.action == 'route_to' and rule.stage_id:
                target_id = rule.action_target.get('stage_id')
                if target_id and str(target_id) in graph:
                    graph[str(rule.stage_id)].append(str(target_id))

        visited = set()
        rec_stack = set()
        
        def is_cyclic(node_id):
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in graph.get(node_id, []):
                if neighbor not in visited:
                    if is_cyclic(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
                    
            rec_stack.remove(node_id)
            return False

        for node in graph:
            if node not in visited:
                if is_cyclic(node):
                    return Response(
                        {"detail": "Circular workflow detected. Please fix 'route_to' rules."},
                        status=status.HTTP_400_BAD_REQUEST
                    )


        stages_data = WorkflowStageSerializer(stages, many=True).data
        rules_data = RuleSerializer(workflow.rules.all(), many=True).data

        snapshot = {
            "stages": stages_data,
            "rules": rules_data
        }

        next_version = workflow.current_version + 1

        with transaction.atomic():
            WorkflowVersion.objects.create(
                workflow=workflow,
                version_number=next_version,
                snapshot=make_json_safe(snapshot),
                changelog=request.data.get('changelog', f'Published version {next_version}'),
                published_by=request.user,
                is_active=True
            )

            workflow.current_version = next_version
            workflow.is_published = True
            workflow.save()

            create_audit_log(
                request.user,
                'workflow_published',
                'workflow',
                workflow.id,
                new_value={"version": next_version},
                request=request
            )

        return Response(WorkflowDetailSerializer(workflow).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    @transaction.atomic
    def unpublish(self, request, pk=None):
        workflow = self.get_object()
        if not workflow.is_published:
            return Response({"detail": "Workflow is already unpublished."}, status=status.HTTP_400_BAD_REQUEST)

        workflow.is_published = False
        workflow.save()

        create_audit_log(
            request.user,
            'workflow_unpublished',
            'workflow',
            workflow.id,
            request=request
        )

        return Response(WorkflowDetailSerializer(workflow).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def versions_list(self, request, pk=None):
        workflow = self.get_object()
        versions = workflow.versions.all().order_by('-version_number')
        serializer = WorkflowVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def versions_detail(self, request, pk=None, version_id=None):
        workflow = self.get_object()
        version = get_object_or_404(WorkflowVersion, workflow=workflow, id=version_id)
        serializer = WorkflowVersionSerializer(version)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def versions_restore(self, request, pk=None, version_id=None):
        from django.db import transaction
        workflow = self.get_object()
        version = get_object_or_404(WorkflowVersion, workflow=workflow, id=version_id)
        snapshot = version.snapshot

        with transaction.atomic():
            # 1. Wipe current draft stages & rules
            workflow.stages.all().delete()
            workflow.rules.all().delete()

            # 2. Recreate Stages
            stage_mapping = {} # old_id -> new_id
            for stage_data in snapshot.get('stages', []):
                old_id = stage_data.get('id')
                specific_approver_id = None
                if stage_data.get('specific_approver'):
                    specific_approver_id = stage_data['specific_approver'].get('id')

                new_stage = WorkflowStage.objects.create(
                    workflow=workflow,
                    name=stage_data.get('name'),
                    order=stage_data.get('order'),
                    approver_role=stage_data.get('approver_role'),
                    specific_approver_id=specific_approver_id
                )
                if old_id:
                    stage_mapping[str(old_id)] = str(new_stage.id)

            # 3. Recreate Rules (Recursive Helper)
            def create_rule(rule_data, parent=None, stage_id=None):
                action_target = rule_data.get('action_target')
                if action_target and isinstance(action_target, dict):
                    old_target_stage = action_target.get('stage_id')
                    if old_target_stage and str(old_target_stage) in stage_mapping:
                        action_target['stage_id'] = stage_mapping[str(old_target_stage)]

                new_rule = Rule.objects.create(
                    workflow=workflow,
                    stage_id=stage_id,
                    parent_rule=parent,
                    logical_operator=rule_data.get('logical_operator', ''),
                    field_name=rule_data.get('field_id', '') or rule_data.get('field_name', ''),
                    operator=rule_data.get('operator', ''),
                    value=rule_data.get('value', ''),
                    action=rule_data.get('action', ''),
                    action_target=action_target,
                    order=rule_data.get('order', 0)
                )
                for child_data in rule_data.get('children', []):
                    create_rule(child_data, parent=new_rule, stage_id=stage_id)

            for rule_data in snapshot.get('rules', []):
                old_stage_id = rule_data.get('target_stage_id')
                new_stage_id = stage_mapping.get(str(old_stage_id)) if old_stage_id else None
                create_rule(rule_data, parent=None, stage_id=new_stage_id)

            # 4. Publish as a new version
            workflow.refresh_from_db()
            import json
            from django.core.serializers.json import DjangoJSONEncoder
            from workflows.serializers import WorkflowDetailSerializer
            raw_snapshot = WorkflowDetailSerializer(workflow).data
            new_snapshot = json.loads(json.dumps(raw_snapshot, cls=DjangoJSONEncoder))
            
            next_version = (workflow.current_version or 0) + 1
            WorkflowVersion.objects.create(
                workflow=workflow,
                version_number=next_version,
                snapshot=new_snapshot,
                changelog=f'Restored from v{version.version_number}',
                published_by=request.user,
                is_active=True
            )
            workflow.current_version = next_version
            workflow.is_published = True
            workflow.save()

            create_audit_log(
                request.user,
                'workflow_restored',
                'workflow',
                workflow.id,
                new_value={"restored_from_version": version.version_number},
                request=request
            )

        return Response(WorkflowDetailSerializer(workflow).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def versions_diff(self, request, pk=None, v1_id=None, v2_id=None):
        workflow = self.get_object()
        
        if v1_id == 'v0':
            v1_snapshot = {"stages": [], "rules": []}
        else:
            v1 = get_object_or_404(WorkflowVersion, workflow=workflow, id=v1_id)
            v1_snapshot = v1.snapshot
            
        if v2_id == 'v0':
            v2_snapshot = {"stages": [], "rules": []}
        else:
            v2 = get_object_or_404(WorkflowVersion, workflow=workflow, id=v2_id)
            v2_snapshot = v2.snapshot
            
        diff = diff_snapshots(v1_snapshot, v2_snapshot)
        return Response(diff, status=status.HTTP_200_OK)


class WorkflowStageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for stage operations. Supports nesting under workflows, reordering, and validation.
    """
    permission_classes = [IsAdmin]
    serializer_class = WorkflowStageSerializer

    def get_queryset(self):
        wf_id = self.kwargs.get('wf_id')
        get_active_workflow_or_404(wf_id)
        return WorkflowStage.objects.filter(workflow_id=wf_id)

    def perform_create(self, serializer):
        workflow = get_active_workflow_or_404(self.kwargs['wf_id'])
        check_workflow_not_published(workflow)

        max_order = workflow.stages.aggregate(models.Max('order'))['order__max'] or 0
        instance = serializer.save(workflow=workflow, order=max_order + 1)

        create_audit_log(
            self.request.user,
            'stage_created',
            'workflow_stage',
            instance.id,
            new_value=WorkflowStageSerializer(instance).data,
            request=self.request
        )

    def perform_update(self, serializer):
        workflow = serializer.instance.workflow
        check_workflow_not_published(workflow)

        old_data = WorkflowStageSerializer(serializer.instance).data
        instance = serializer.save()

        create_audit_log(
            self.request.user,
            'stage_updated',
            'workflow_stage',
            instance.id,
            old_value=old_data,
            new_value=WorkflowStageSerializer(instance).data,
            request=self.request
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        workflow = instance.workflow
        check_workflow_not_published(workflow)

        create_audit_log(
            self.request.user,
            'stage_deleted',
            'workflow_stage',
            instance.id,
            old_value=WorkflowStageSerializer(instance).data,
            request=self.request
        )

        instance.delete()

        remaining_stages = workflow.stages.all().order_by('order')
        for index, stage in enumerate(remaining_stages, start=1):
            if stage.order != index:
                stage.order = index
                stage.save()

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def reorder(self, request, wf_id=None):
        workflow = get_active_workflow_or_404(wf_id)
        check_workflow_not_published(workflow)

        stage_ids = request.data.get('stage_ids', [])
        if not isinstance(stage_ids, list):
            raise ValidationError({"stage_ids": "Must be a list of UUIDs."})

        stages = workflow.stages.filter(id__in=stage_ids)
        if stages.count() != len(stage_ids) or stages.count() != workflow.stages.count():
            raise ValidationError({"detail": "List of stage IDs must match all active stages of the workflow."})

        for stage in stages:
            stage.order = stage.order + 10000
            stage.save()

        stage_map = {str(stage.id): stage for stage in stages}
        for index, s_id in enumerate(stage_ids, start=1):
            stage = stage_map.get(str(s_id))
            if stage:
                stage.order = index
                stage.save()

        create_audit_log(
            request.user,
            'stage_reordered',
            'workflow',
            workflow.id,
            new_value={"stage_ids": stage_ids},
            request=request
        )

        return Response({"detail": "Stages reordered successfully."}, status=status.HTTP_200_OK)



class RuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage Rules. Can be routed nested under workflow or standalone.
    """
    permission_classes = [IsAdmin]
    serializer_class = RuleSerializer
    queryset = Rule.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset().select_related('workflow', 'stage', 'parent_rule')
        wf_id = self.kwargs.get('wf_id')
        if wf_id:
            queryset = queryset.filter(workflow_id=wf_id)
        return queryset

    def perform_create(self, serializer):
        wf_id = self.kwargs.get('wf_id')
        workflow = get_active_workflow_or_404(wf_id)
        check_workflow_not_published(workflow)
        instance = serializer.save(workflow=workflow)

        create_audit_log(
            self.request.user,
            'rule_created',
            'rule',
            instance.id,
            new_value=RuleSerializer(instance).data,
            request=self.request
        )

    def perform_update(self, serializer):
        workflow = serializer.instance.workflow
        check_workflow_not_published(workflow)

        old_data = RuleSerializer(serializer.instance).data
        instance = serializer.save()

        create_audit_log(
            self.request.user,
            'rule_updated',
            'rule',
            instance.id,
            old_value=old_data,
            new_value=RuleSerializer(instance).data,
            request=self.request
        )

    def perform_destroy(self, instance):
        workflow = instance.workflow
        check_workflow_not_published(workflow)

        create_audit_log(
            self.request.user,
            'rule_deleted',
            'rule',
            instance.id,
            old_value=RuleSerializer(instance).data,
            request=self.request
        )

        instance.delete()

    @action(detail=False, methods=['get'])
    def tree(self, request, wf_id=None):
        workflow = get_active_workflow_or_404(wf_id)
        root_rules = workflow.rules.filter(parent_rule=None).order_by('order')
        serializer = RuleTreeSerializer(root_rules, many=True)
        return Response(serializer.data)

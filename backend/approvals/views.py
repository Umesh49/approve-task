from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from approvals.models import ApprovalRequest, StageExecution
from approvals.serializers import (
    ApprovalRequestSerializer,
    ApprovalRequestCreateSerializer,
    StageExecutionSerializer
)
from approvals.filters import ApprovalRequestFilter
from audit.utils import create_audit_log
from workflows.rule_engine import get_rule_actions

class ApprovalRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage ApprovalRequests.
    Filters list view based on role:
      - Admin: all requests
      - Approver: own requests + requests currently assigned to them or their role
      - Requester: own requests
    """
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = ApprovalRequestFilter
    search_fields = ['title']
    ordering_fields = ['created_at', 'updated_at', 'status', 'priority']

    def get_serializer_class(self):
        if self.action == 'create':
            return ApprovalRequestCreateSerializer
        return ApprovalRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            queryset = ApprovalRequest.objects.all()
        else:
            from django.db.models import Q
            queryset = ApprovalRequest.objects.filter(
                Q(submitted_by=user) |
                Q(current_stage__specific_approver=user) |
                Q(current_stage__approver_role=user.role)
            ).distinct()
            
        return queryset.select_related(
            'workflow', 'workflow_version', 'submitted_by', 'current_stage'
        ).prefetch_related(
            'stage_executions', 'stage_executions__stage',
            'stage_executions__assigned_to', 'stage_executions__acted_by'
        ).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        workflow = serializer.validated_data['workflow']
        workflow_version = serializer.validated_data['workflow_version']
        
        request_obj = serializer.save(
            submitted_by=self.request.user,
            workflow_version=workflow_version,
            status=ApprovalRequest.STATUS_IN_PROGRESS
        )
        
        actions = get_rule_actions(workflow, request_obj.data)
        
        stages = workflow.stages.all().order_by('order')
        
        first_pending_stage = None
        for stage in stages:
            is_skipped = False
            skipped_reason = None
            for act in actions:
                if act['action'] == 'skip_stage' and act['stage_id'] == str(stage.id):
                    is_skipped = True
                    skipped_reason = f"Skipped by rule: {act['rule_id']}"
                    break
            
            status_val = StageExecution.STATUS_SKIPPED if is_skipped else StageExecution.STATUS_PENDING
            assigned_to = stage.specific_approver
            
            StageExecution.objects.create(
                request=request_obj,
                stage=stage,
                stage_order=stage.order,
                status=status_val,
                assigned_to=assigned_to,
                skipped_reason=skipped_reason
            )
            
            if not is_skipped and first_pending_stage is None:
                first_pending_stage = stage
                
        if first_pending_stage:
            request_obj.current_stage = first_pending_stage
        else:
            request_obj.status = ApprovalRequest.STATUS_APPROVED
            request_obj.current_stage = None
            
        request_obj.save()
        
        create_audit_log(
            self.request.user,
            'request_submitted',
            'approval_request',
            request_obj.id,
            new_value=ApprovalRequestSerializer(request_obj).data,
            request=self.request
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        """
        Approves the current stage of the request, shifting to the next non-skipped stage.
        Locks request using select_for_update to prevent concurrency conflicts.
        """
        try:
            request_obj = ApprovalRequest.objects.select_for_update().get(id=pk)
        except ApprovalRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if request_obj.status != ApprovalRequest.STATUS_IN_PROGRESS:
            raise ValidationError({"detail": "This request is not in progress."})
            
        current_stage = request_obj.current_stage
        if not current_stage:
            raise ValidationError({"detail": "No active stage for this request."})
            
        stage_id = request.data.get('stage_id')
        if stage_id and str(request_obj.current_stage_id) != str(stage_id):
            return Response({"detail": "The stage has already been processed or changed."}, status=status.HTTP_409_CONFLICT)
            
        user = request.user
        is_authorized = (
            user.role == 'admin' or
            current_stage.specific_approver == user or
            current_stage.approver_role == user.role
        )
        if not is_authorized:
            raise PermissionDenied("You are not authorized to approve this stage.")
            
        current_exec = request_obj.stage_executions.filter(stage=current_stage, status=StageExecution.STATUS_PENDING).first()
        if not current_exec:
            return Response({"detail": "Stage is already processed or invalid."}, status=status.HTTP_409_CONFLICT)
            
        comments = request.data.get('comments', '')
        current_exec.status = StageExecution.STATUS_APPROVED
        current_exec.acted_by = user
        current_exec.acted_at = timezone.now()
        current_exec.comments = comments
        current_exec.save()
        
        actions = get_rule_actions(request_obj.workflow, request_obj.data)
        
        visited_stages = set(str(sid) for sid in request_obj.stage_executions.filter(
            status__in=[StageExecution.STATUS_APPROVED, StageExecution.STATUS_REJECTED]
        ).values_list('stage_id', flat=True))

        evaluations = request_obj.data.get('_evaluations', 0)
        
        candidate_stage = None
        terminate = False
        
        for act in actions:
            if act['stage_id'] == str(current_stage.id):
                if act['action'] == 'route_to':
                    target_id = act['action_target'].get('stage_id')
                    candidate_stage = request_obj.workflow.stages.filter(id=target_id).first()
                elif act['action'] == 'terminate':
                    terminate = True
                    
        if not candidate_stage and not terminate:
            candidate_stage = request_obj.workflow.stages.filter(
                order__gt=current_stage.order
            ).order_by('order').first()

        while candidate_stage and not terminate:
            evaluations += 1
            if evaluations > 50:
                request_obj.status = ApprovalRequest.STATUS_TERMINATED
                request_obj.current_stage = None
                request_obj.data['_evaluations'] = evaluations
                request_obj.save()
                return Response({"detail": "Infinite loop detected (max 50 evaluations). Request terminated."}, status=status.HTTP_400_BAD_REQUEST)
                
            if str(candidate_stage.id) in visited_stages:
                request_obj.status = ApprovalRequest.STATUS_TERMINATED
                request_obj.current_stage = None
                request_obj.data['_evaluations'] = evaluations
                request_obj.save()
                return Response({"detail": "Infinite loop detected (stage visited twice). Request terminated."}, status=status.HTTP_400_BAD_REQUEST)
                
            is_skipped = any(
                act['action'] == 'skip_stage' and act['stage_id'] == str(candidate_stage.id) 
                for act in actions
            )
            
            if is_skipped:
                exec_obj = request_obj.stage_executions.filter(stage=candidate_stage).first()
                if exec_obj and exec_obj.status != StageExecution.STATUS_SKIPPED:
                    exec_obj.status = StageExecution.STATUS_SKIPPED
                    exec_obj.skipped_reason = "Skipped by rule"
                    exec_obj.save()
                    
                visited_stages.add(str(candidate_stage.id))
                candidate_stage = request_obj.workflow.stages.filter(
                    order__gt=candidate_stage.order
                ).order_by('order').first()
                continue
                
            break

        request_obj.data['_evaluations'] = evaluations

        if terminate:
            request_obj.status = ApprovalRequest.STATUS_TERMINATED
            request_obj.current_stage = None
        elif candidate_stage:
            exec_obj = request_obj.stage_executions.filter(stage=candidate_stage).first()
            if exec_obj:
                exec_obj.status = StageExecution.STATUS_PENDING
                exec_obj.save()
            request_obj.current_stage = candidate_stage
        else:
            request_obj.status = ApprovalRequest.STATUS_APPROVED
            request_obj.current_stage = None
            
        request_obj.save()
        
        serialized_data = ApprovalRequestSerializer(request_obj).data
        
        create_audit_log(
            user,
            'request_approved',
            'approval_request',
            request_obj.id,
            new_value=serialized_data,
            request=request
        )

        return Response(serialized_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        """
        Rejects the current stage of the request and terminates the request.
        Comments/reason are required.
        """
        try:
            request_obj = ApprovalRequest.objects.select_for_update().get(id=pk)
        except ApprovalRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if request_obj.status != ApprovalRequest.STATUS_IN_PROGRESS:
            raise ValidationError({"detail": "This request is not in progress."})
            
        current_stage = request_obj.current_stage
        if not current_stage:
            raise ValidationError({"detail": "No active stage for this request."})
            
        stage_id = request.data.get('stage_id')
        if stage_id and str(request_obj.current_stage_id) != str(stage_id):
            return Response({"detail": "The stage has already been processed or changed."}, status=status.HTTP_409_CONFLICT)
            
        comments = request.data.get('comments', '').strip()
        if not comments:
            raise ValidationError({"comments": "Comments/reason required on rejection."})
            
        user = request.user
        is_authorized = (
            user.role == 'admin' or
            current_stage.specific_approver == user or
            current_stage.approver_role == user.role
        )
        if not is_authorized:
            raise PermissionDenied("You are not authorized to reject this stage.")
            
        current_exec = request_obj.stage_executions.filter(stage=current_stage, status=StageExecution.STATUS_PENDING).first()
        if not current_exec:
            return Response({"detail": "Stage is already processed or invalid."}, status=status.HTTP_409_CONFLICT)
            
        current_exec.status = StageExecution.STATUS_REJECTED
        current_exec.acted_by = user
        current_exec.acted_at = timezone.now()
        current_exec.comments = comments
        current_exec.save()
        
        request_obj.status = ApprovalRequest.STATUS_REJECTED
        request_obj.current_stage = None
        request_obj.save()
        
        serialized_data = ApprovalRequestSerializer(request_obj).data
        
        create_audit_log(
            user,
            'request_rejected',
            'approval_request',
            request_obj.id,
            new_value=serialized_data,
            request=request
        )

        return Response(serialized_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def rollback(self, request, pk=None):
        """
        Performs a rollback of type: previous_step, beginning, or terminate.
        """
        try:
            request_obj = ApprovalRequest.objects.select_for_update().get(id=pk)
        except ApprovalRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if request_obj.status not in (ApprovalRequest.STATUS_IN_PROGRESS, ApprovalRequest.STATUS_PENDING):
            raise ValidationError({"detail": "Cannot rollback request that is not in progress."})
            
        user = request.user
        if user.role != 'admin' and request_obj.submitted_by != user:
            raise PermissionDenied("Only admins or the original requester can perform a rollback.")
            
        rb_type = request.data.get('type')
        if rb_type not in ['previous_step', 'beginning', 'terminate']:
            raise ValidationError({"type": "Invalid rollback type. Must be previous_step, beginning, or terminate."})
            
        current_stage = request_obj.current_stage
        current_exec = request_obj.stage_executions.filter(stage=current_stage).last()
        
        old_state = ApprovalRequestSerializer(request_obj).data
        
        if rb_type == 'terminate':
            request_obj.status = ApprovalRequest.STATUS_TERMINATED
            request_obj.current_stage = None
            request_obj.save()
            
            if current_exec:
                current_exec.status = StageExecution.STATUS_ROLLED_BACK
                current_exec.save()
                
        elif rb_type == 'previous_step':
            if not current_exec:
                raise ValidationError({"detail": "No active execution stage to rollback from."})
                
            prev_exec = request_obj.stage_executions.filter(
                stage_order__lt=current_exec.stage_order
            ).exclude(status=StageExecution.STATUS_SKIPPED).order_by('-stage_order').first()
            
            if not prev_exec:
                raise ValidationError({"detail": "Cannot rollback to previous step from the first stage. Use terminate instead."})
                
            snapshot_stage_ids = [s.get('id') for s in request_obj.workflow_version.snapshot.get('stages', [])]
            if str(prev_exec.stage.id) not in snapshot_stage_ids:
                raise ValidationError({"detail": "Rollback target stage no longer exists in the pinned workflow version."})
                
            current_exec.status = StageExecution.STATUS_ROLLED_BACK
            current_exec.save()
            
            prev_exec.status = StageExecution.STATUS_PENDING
            prev_exec.acted_by = None
            prev_exec.acted_at = None
            prev_exec.comments = ''
            prev_exec.save()
            
            request_obj.current_stage = prev_exec.stage
            request_obj.status = ApprovalRequest.STATUS_IN_PROGRESS
            request_obj.save()
            
        elif rb_type == 'beginning':
            request_obj.stage_executions.filter(
                status__in=(StageExecution.STATUS_APPROVED, StageExecution.STATUS_REJECTED, StageExecution.STATUS_PENDING, StageExecution.STATUS_ROLLED_BACK)
            ).update(status=StageExecution.STATUS_ROLLED_BACK)
            
            actions = get_rule_actions(request_obj.workflow, request_obj.data)
            
            request_obj.stage_executions.all().delete()
            stages = request_obj.workflow.stages.all().order_by('order')
            first_pending_stage = None
            
            for stage in stages:
                is_skipped = any(act['action'] == 'skip_stage' and act['stage_id'] == str(stage.id) for act in actions)
                status_val = StageExecution.STATUS_SKIPPED if is_skipped else StageExecution.STATUS_PENDING
                skipped_reason = "Skipped by rule re-evaluation on rollback" if is_skipped else None
                
                StageExecution.objects.create(
                    request=request_obj,
                    stage=stage,
                    stage_order=stage.order,
                    status=status_val,
                    assigned_to=stage.specific_approver,
                    skipped_reason=skipped_reason
                )
                
                if not is_skipped and first_pending_stage is None:
                    first_pending_stage = stage
                    
            if first_pending_stage:
                snapshot_stage_ids = [s.get('id') for s in request_obj.workflow_version.snapshot.get('stages', [])]
                if str(first_pending_stage.id) not in snapshot_stage_ids:
                    raise ValidationError({"detail": "Rollback target stage no longer exists in the pinned workflow version."})
                request_obj.current_stage = first_pending_stage
                request_obj.status = ApprovalRequest.STATUS_IN_PROGRESS
            else:
                request_obj.current_stage = None
                request_obj.status = ApprovalRequest.STATUS_APPROVED
                
            request_obj.save()
            
        serialized_data = ApprovalRequestSerializer(request_obj).data
        
        create_audit_log(
            user,
            f"request_rolled_back_{rb_type}",
            'approval_request',
            request_obj.id,
            old_value=old_state,
            new_value=serialized_data,
            request=request
        )

        return Response(serialized_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """
        Returns a timeline of stage executions for a request.
        """
        request_obj = self.get_object()
        executions = request_obj.stage_executions.all().order_by('stage_order')
        serializer = StageExecutionSerializer(executions, many=True)
        return Response(serializer.data)


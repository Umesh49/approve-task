import json
from django.conf import settings
from groq import Groq
from django.contrib.auth import get_user_model

User = get_user_model()

class GroqService:
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = "llama-3.1-8b-instant"  # Ensure valid groq model name

    def _get_context(self, user):
        # Fetch valid users and roles for tagging
        users = User.objects.all().values('id', 'username', 'email', 'role')
        user_list = ", ".join([f"ID: {u['id']} (Name: {u['username']}, Role: {u['role']})" for u in users])
        
        # Fetch existing workflows for context
        from workflows.models import Workflow
        workflows = Workflow.objects.filter(is_deleted=False).prefetch_related('stages', 'rules')
        workflow_context = []
        for wf in workflows:
            stages_info = [f"Stage {s.order+1}: {s.name} (ID: {s.id}, Approver: {s.approver_role or s.specific_approver_id})" for s in wf.stages.all()]
            rules_info = [f"If {r.field_name} {r.operator} {r.value} -> {r.action}" for r in wf.rules.all()]
            workflow_context.append(f"Workflow ID: {wf.id}\nName: {wf.name}\nStages: {', '.join(stages_info)}\nRules: {', '.join(rules_info)}")
        workflow_list_str = "\n\n".join(workflow_context) if workflow_context else "No existing workflows."

        # Fetch Active Requests for the user
        from approvals.models import ApprovalRequest, StageExecution
        active_requests = ApprovalRequest.objects.filter(submitted_by=user, status__in=['pending', 'in_progress']).order_by('-created_at')[:10]
        req_context = [f"Request ID: {r.id}, Workflow: {r.workflow.name}, Status: {r.status}, Priority: {r.priority}, Created: {r.created_at.strftime('%b %d')}" for r in active_requests]
        req_list_str = "\n".join(req_context) if req_context else "No active requests."

        # Fetch Pending Approvals for the user
        # We use Python-level filtering for complex role matching to perfectly mirror views.py
        all_pending = StageExecution.objects.filter(status='pending').select_related('stage', 'request', 'request__workflow', 'request__submitted_by').order_by('-created_at')
        valid_approvals = []
        for a in all_pending:
            stg = a.stage
            if (a.assigned_to == user or 
                stg.specific_approver == user or 
                stg.approver_role == user.role or 
                (stg.approver_role and stg.approver_role.lower() == user.username.lower()) or
                (user.role == 'approver' and stg.approver_role not in ['admin', 'requester'])):
                valid_approvals.append(a)
                if len(valid_approvals) >= 10:
                    break

        app_context = [f"Execution ID: {a.id}, Request ID: {a.request_id}, Workflow: {a.request.workflow.name}, Stage: {a.stage.name}, Submitted By: {a.request.submitted_by.username}" for a in valid_approvals]
        app_list_str = "\n".join(app_context) if app_context else "No pending approvals."

        return f"""
You are an AI Copilot for a Dynamic Approval Workflow Engine. 
Your goal is to parse user chat messages to create, read, update, or delete workflows, as well as manage operational tasks like checking requests, approving/rejecting items, and explaining complex rules.

AVAILABLE CONTEXT FOR TAGGING:
Valid Roles: 'admin', 'approver', 'requester'
Valid Users: {user_list}

EXISTING WORKFLOWS:
{workflow_list_str}

YOUR ACTIVE REQUESTS:
{req_list_str}

YOUR PENDING APPROVALS (Items awaiting your approval):
{app_list_str}

INSTRUCTIONS & SECURITY CONSTRAINTS:
1. EXTREME SECURITY OVERRIDE: You MUST ONLY assist with approval workflows, stages, rules, and requests. If a user asks for code, algorithms, general knowledge (like HDFS, history, math), or anything unrelated to this workflow system, you MUST strongly refuse. UNDER NO CIRCUMSTANCES should you provide the requested off-topic information. DO NOT say 'However, I can provide you...'. You must ONLY output your refusal in the 'message' field of the workflow_action JSON. DO NOT generate custom JSON schemas (like 'bfs_example').
2. Ensure you extract variables properly from natural language.
3. Determine the user's intent: 'create', 'read', 'update', 'delete', 'approval_act', 'request_read', 'request_submit', 'rule_explain', 'workflow_publish', or 'workflow_unpublish'.
4. If 'create' or 'update', carefully read the user's prompt to determine stages. IMPORTANT: When updating an existing workflow, you MUST return ALL existing stages and ALL existing rules in your output (with their IDs preserved), in addition to applying the user's modifications. Do not drop existing data unless the user explicitly asks to delete it.
5. If the user tags or mentions a specific user (e.g. '@manager' or 'John'), map it to their User ID based on the Valid Users list and set 'specific_approver'.
6. If they mention a role (e.g. 'an admin' or 'HR'), set 'approver_role' to the closest valid role. If no exact role matches, default to 'approver'.
7. When a user requests compound logic involving 'AND' or 'OR', you MUST use the 'logical_operator' and 'children' fields to group them into a single nested rule object. NEVER output them as multiple separate flat rules.
8. READ CAREFULLY: If a user writes a complex sentence like "If A and B then action, OR if C then action", you MUST build a SINGLE root "OR" node with the action on it. Child 1 must be an "AND" node containing A and B. Child 2 must be C. DO NOT split them into separate root rules! DO NOT lose the "AND" grouping!
9. If a user asks you to approve or reject a request, but they have multiple pending approvals and their instruction is ambiguous, DO NOT guess which one to approve. Set intent to 'read' or 'request_read' and use the 'message' field to ask the user to be more specific (e.g. mention the workflow name or request ID).

JSON SCHEMA FOR WORKFLOW ACTION:
You MUST output ONLY raw JSON. No markdown backticks, no conversational text.
{{
    "type": "workflow_action",
    "intent": "create (build new workflow) | read (find workflows) | update (edit stages/rules of existing workflow) | delete | approval_act (approve/reject request) | request_read (view requests) | request_submit (fill out form) | rule_explain | workflow_publish (make workflow live) | workflow_unpublish (take workflow offline)",
    "target_workflow_id": "uuid string (Required if intent is read, update, delete, request_submit, workflow_publish, or workflow_unpublish. Use null otherwise)",
    "target_request_id": "uuid string (Required if intent is approval_act. This is the Request ID)",
    "approval_status": "approved | rejected (Required if intent is approval_act)",
    "approval_comment": "string (Optional comment justifying the approval/rejection)",
    "message": "string (Conversational response summarizing pending requests, explaining rules, or confirming actions)",
    "submit_data": {{
        "title": "string (Title of the request, e.g. 'Laptop Request')",
        "data": "key-value object (e.g. {{'amount': 1000, 'department': 'IT'}})"
    }},
    "draft_data": {{
        "name": "string",
        "description": "string",
        "stages": [
            {{
                "id": "uuid string | null (MUST preserve existing Stage ID if updating an existing stage, otherwise null)",
                "name": "string",
                "approver_role": "string | null",
                "specific_approver": "integer | null"
            }}
        ],
        "rules": [
            {{
                "stage_index": "integer (0-based index of the stage this rule evaluates ON)",
                "logical_operator": "AND | OR | null (Set this if this rule is a logical grouping of children)",
                "children": "array of rule objects (Required if logical_operator is set)",
                "field_name": "string (e.g. amount, department. Null if logical_operator is set)",
                "operator": "string (MUST be one of: gt, lt, eq, neq, gte, lte, in, not_in. Null if logical_operator is set)",
                "value": "string or number (Null if logical_operator is set)",
                "action": "string (MUST be one of: skip_stage, add_approval, route_to, terminate, none)",
                "action_target_stage_index": "integer | null"
            }}
        ]
    }} // Note: draft_data should be populated ONLY for create or update intents
}}

EXAMPLE OF NESTED LOGICAL RULE ((amount > 1000 AND department eq IT) OR amount < 5):
"rules": [
  {{
    "stage_index": 0,
    "logical_operator": "OR",
    "action": "skip_stage",
    "children": [
      {{
        "stage_index": 0,
        "logical_operator": "AND",
        "children": [
          {{
            "stage_index": 0,
            "field_name": "amount",
            "operator": "gt",
            "value": "1000"
          }},
          {{
            "stage_index": 0,
            "field_name": "department",
            "operator": "eq",
            "value": "IT"
          }}
        ]
      }},
      {{
        "stage_index": 0,
        "field_name": "amount",
        "operator": "lt",
        "value": "5"
      }}
    ]
  }}
]
"""

    def generate_chat_response(self, message: str, user, history: list = None) -> dict:
        try:
            messages_payload = [{"role": "system", "content": self._get_context(user)}]
            
            if history:
                for h in history:
                    messages_payload.append({
                        "role": h.get("role", "user"),
                        "content": h.get("content", "")
                    })
                    
            messages_payload.append({"role": "user", "content": message})
            
            response = self.client.chat.completions.create(
                messages=messages_payload,
                model=self.model,
                temperature=0.1,
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to parse as JSON (if it generated an action)
            import re
            try:
                # Robust JSON extraction to handle markdown and conversational wrappers
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    json_str = match.group(0)
                    data = json.loads(json_str)
                    if data.get("type") == "workflow_action":
                        return {"type": "workflow_action", "data": data}
            except json.JSONDecodeError:
                pass
                
            return {"type": "chat", "message": content}

        except Exception as e:
            return {"type": "error", "message": str(e)}

import type { TimelineNode } from '@/components/timeline/ExecutionTimeline'


export interface Stage {
  id: string
  name: string
  order: number
  approver_type: 'role' | 'user'
  approver_role?: string
  specific_approver?: string
  is_skippable: boolean
  stage_type: 'approval' | 'review'
}

export interface RuleNode {
  id: string
  logical_operator?: 'AND' | 'OR'
  children?: RuleNode[]

  field_id?: string
  operator?: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'not_in'
  value?: string

  action?: 'skip_stage' | 'terminate' | 'none'
  target_stage_id?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: 'draft' | 'published'
  is_published?: boolean
  updated_at?: string
  current_version: number
  stages: Stage[]

  rules: RuleNode[]
}

export interface ApprovalRequest {
  id: string
  title: string
  workflowId: string
  workflowName: string
  submittedBy: string
  status: 'pending' | 'approved' | 'rejected' | 'terminated' | 'rolled_back' | 'in_progress'
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  data: Record<string, any>
  currentStageId: string
  timeline: TimelineNode[]
}
export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_value?: string
  new_value?: string
  actor: string
  actor_username: string
  timestamp: string
  ip_address?: string
  user_agent?: string
}

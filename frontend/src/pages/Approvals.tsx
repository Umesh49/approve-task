import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Loader2
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ExecutionTimeline } from '@/components/timeline/ExecutionTimeline'

interface ApprovalRequest {
  id: string
  title: string
  workflowId: string
  workflow_name: string
  submittedBy: string
  status: 'pending' | 'approved' | 'rejected' | 'terminated' | 'rolled_back' | 'in_progress'
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  data: Record<string, any>
  currentStageId: string
  timeline: any[]
}

import { api } from '@/services/api'
import { formatDistanceToNow } from 'date-fns'

interface StageExecution {
  id: string
  stage_name: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'skipped'
  assigned_to_username?: string
  acted_by_username?: string
  comments?: string
  acted_at?: string
}

interface ApprovalRequest {
  id: string
  title: string
  workflow_name: string
  submitted_by_username: string
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'terminated' | 'rolled_back'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  data: Record<string, any>
  current_stage_name: string
  stage_executions: StageExecution[]
}

export function Approvals() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [decisionComments, setDecisionComments] = useState('')

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const response = await api.get('/api/requests/?status=in_progress')
      const allRequests = response.data.results || response.data
      if (!Array.isArray(allRequests)) return []
      return allRequests.filter((req: any) => req.is_actionable)
    },
    enabled: !!user
  })

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: 'approve' | 'reject' }) => {
      await api.post(`/api/requests/${id}/${action}/`, { comments: decisionComments.trim() })
      return action
    },
    onSuccess: (action) => {
      toast.success(`Request successfully ${action}d!`)
      setExpandedId(null)
      setDecisionComments('')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: (error: any, { action }) => {
      console.error(`Failed to ${action} request:`, error)
      const msg = error.response?.data?.detail || error.response?.data?.comments?.[0] || error.response?.data?.comments || `Failed to ${action} request.`
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  })

  if (!user) return null

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-md" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </motion.div>
    )
  }



  const handleDecision = (id: string, action: 'approve' | 'reject') => {
    decisionMutation.mutate({ id, action })
  }

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'critical':
        return 'border-danger/20 bg-danger-light text-danger'
      case 'high':
        return 'border-danger/10 bg-danger-light text-danger'
      case 'medium':
        return 'border-warning/20 bg-warning-light text-warning'
      case 'low':
        return 'border-border bg-muted text-muted-foreground'
      default:
        return 'border-border bg-muted text-muted-foreground'
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Approvals</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review your outstanding tasks. Decision comments are logged in the audit history.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {approvals.map((req, i) => (
            <motion.div 
              key={req.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card id={`approval-card-${req.id}`} className="border border-border bg-card rounded-md shadow-none overflow-hidden transition-all hover:border-ring">
                <div
                  id={`approval-header-${req.id}`}
                  onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-background/40 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-bold text-sm text-foreground truncate">
                        {req.title}
                      </span>
                      <Badge variant="outline" className={`text-[9px] font-bold uppercase rounded-md px-1.5 ${getPriorityBadge(req.priority)}`}>
                        {req.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-muted-foreground font-semibold">
                      <span>Template: {req.workflow_name}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Submitted {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">
                      {expandedId === req.id ? 'Close' : 'Review'}
                    </span>
                    {expandedId === req.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>

                {expandedId === req.id && (
                  <div className="border-t border-border bg-background/30 p-5 space-y-5">
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wide">
                        Submitted Fields context
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card p-4 border border-border rounded-md">
                        <div className="space-y-0.5 text-xs">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold block">Requester username</span>
                          <span className="font-semibold text-foreground flex items-center space-x-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{req.submitted_by_username}</span>
                          </span>
                        </div>
                        {Object.entries(req.data || {}).map(([key, val]) => (
                          <div key={key} className="space-y-0.5 text-xs">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">{key.replace('_', ' ')}</span>
                            <span className="font-semibold text-foreground">
                              {typeof val === 'boolean' 
                                ? (val ? 'Yes' : 'No') 
                                : (typeof val === 'object' ? JSON.stringify(val) : String(val))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {req.timeline && req.timeline.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-5">
                        <h4 className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wide">
                          Execution Timeline
                        </h4>
                        <ExecutionTimeline nodes={req.timeline} />
                      </div>
                    )}

                    <div className="space-y-3 border-t border-border pt-5">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Decision Comments
                        </Label>
                        <Textarea
                          id={`textarea-decision-${req.id}`}
                          value={decisionComments}
                          onChange={(e) => setDecisionComments(e.target.value)}
                          className="border-border bg-card rounded-md text-xs h-16 focus-visible:ring-[#1C1917]"
                          placeholder="Provide justification or details."
                        />
                      </div>

                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          id={`btn-approve-${req.id}`}
                          disabled={decisionMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecision(req.id, 'approve');
                          }}
                          className="bg-success hover:bg-success/90 text-white rounded-md text-xs h-8 px-3 flex items-center space-x-1"
                        >
                          {decisionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          <span>Approve</span>
                        </Button>
                        <Button
                          id={`btn-reject-${req.id}`}
                          variant="outline"
                          disabled={decisionMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecision(req.id, 'reject');
                          }}
                          className="border-danger text-danger hover:bg-danger-light rounded-md text-xs h-8 px-3 flex items-center space-x-1"
                        >
                          {decisionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          <span>Reject</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {approvals.length === 0 && (
          <div className="p-12 text-center border border-dashed border-border bg-card rounded-md space-y-2">
            <CheckCircle className="h-8 w-8 mx-auto text-success" />
            <p className="text-xs text-foreground font-bold">You are all caught up!</p>
            <p className="text-[10px] text-muted-foreground">
              No outstanding approval requests are currently waiting for your decision.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  User,
  Briefcase,
  AlertOctagon,
  ChevronDown,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/services/api'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExecutionTimeline } from '@/components/timeline/ExecutionTimeline'

import { mapStageExecutionsToTimeline } from '@/lib/utils'

interface ApprovalRequest {
  id: string
  title: string
  workflow: string
  workflow_name: string
  submitted_by_username: string
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'terminated' | 'rolled_back'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  data: Record<string, any>
  current_stage: string
  current_stage_name: string
  stage_executions: any[]
}

export function Requests() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: requests = [], isLoading: isLoadingReq } = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const res = await api.get('/api/requests/')
      const allReqs = res.data.results || res.data
      return Array.isArray(allReqs) ? allReqs : []
    },
    enabled: !!user
  })

  const { data: workflows = [], isLoading: isLoadingWf } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows/')
      return res.data.results || res.data
    }
  })

  const isLoading = isLoadingReq || isLoadingWf

  const [viewingRequest, setViewingRequest] = useState<ApprovalRequest | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [creationStep, setCreationStep] = useState(1)
  const [isFetchingFields, setIsFetchingFields] = useState(false)

  useEffect(() => {
    if (location.search.includes('create=true')) {
      setIsCreating(true)
      navigate('/requests', { replace: true })
    }
  }, [location, navigate])

  const [selectedWfId, setSelectedWfId] = useState('')
  const [reqTitle, setReqTitle] = useState('')
  const [reqPriority, setReqPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [workflowFields, setWorkflowFields] = useState<string[]>([])
  const [selectedRollback, setSelectedRollback] = useState<'previous_step' | 'beginning' | 'terminate' | ''>('')

  const handleSelectWorkflow = async (wfId: string) => {
    setSelectedWfId(wfId)
    setFormData({})
    setWorkflowFields([])
    setCreationStep(2)
    setIsFetchingFields(true)
    
    try {
      const res = await api.get(`/api/workflows/${wfId}/`)
      const rules = res.data.rules || []
      const fields = new Set<string>()
      
      const extractFields = (ruleList: any[]) => {
        for (const r of ruleList) {
          if (r.field_id) fields.add(r.field_id)
          if (r.children && r.children.length > 0) extractFields(r.children)
        }
      }
      extractFields(rules)
      setWorkflowFields(Array.from(fields))
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetchingFields(false)
    }
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value })
  }

  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/api/requests/', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success('Approval request submitted successfully!')
      setIsCreating(false)
      setCreationStep(1)
      setSelectedWfId('')
      setReqTitle('')
      setFormData({})
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
    onError: (err: any) => {
      let errorMsg = 'Failed to submit request.'
      const data = err?.response?.data
      if (data) {
        if (data.detail) errorMsg = data.detail
        else if (data.non_field_errors?.length) errorMsg = data.non_field_errors[0]
        else if (typeof data === 'object') {
          const firstValue = Object.values(data)[0]
          if (Array.isArray(firstValue) && firstValue.length > 0) {
            errorMsg = firstValue[0]
          } else if (typeof firstValue === 'string') {
            errorMsg = firstValue
          } else {
            errorMsg = JSON.stringify(data)
          }
        } else if (typeof data === 'string') {
          errorMsg = data
        }
      }
      toast.error(errorMsg)
    }
  })

  const submitRequest = () => {
    if (!reqTitle.trim()) {
      toast.error('Request title is required')
      return
    }
    const wf = workflows.find((w: any) => w.id === selectedWfId)
    if (!wf) {
      toast.error('The original workflow for this request has been deleted or is unavailable.')
      return
    }
    
    let parsedData = { ...formData }
    if (parsedData.jsonStr) {
      try {
        const fromJson = JSON.parse(parsedData.jsonStr)
        delete parsedData.jsonStr
        parsedData = { ...parsedData, ...fromJson }
      } catch {
        toast.error('Invalid JSON format in Dynamic Form Data')
        return
      }
    }

    submitMutation.mutate({
      title: reqTitle.trim(),
      workflow: selectedWfId,
      priority: reqPriority,
      data: parsedData
    })
  }

  const rollbackMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: string }) => {
      const res = await api.post(`/api/requests/${id}/rollback/`, { type })
      return res.data
    },
    onSuccess: (_, variables) => {
      toast.success(`Request successfully rolled back: ${variables.type.replace('_', ' ')}`)
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setViewingRequest(null)
      setSelectedRollback('')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to rollback request')
    }
  })

  const handleRollback = () => {
    if (!viewingRequest || !selectedRollback) return
    rollbackMutation.mutate({ id: viewingRequest.id, type: selectedRollback })
  }

  const handleResubmit = () => {
    if (!viewingRequest) return
    
    setIsCreating(true)
    setCreationStep(2)
    setSelectedWfId(viewingRequest.workflow)
    setReqTitle(`${viewingRequest.title} (Resubmitted)`)
    setReqPriority(viewingRequest.priority)
    setFormData(viewingRequest.data ? { jsonStr: JSON.stringify(viewingRequest.data, null, 2) } : {})
    setViewingRequest(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'border-[#16A34A]/20 bg-[#F0FDF4] text-[#16A34A]'
      case 'rejected':
        return 'border-[#DC2626]/20 bg-[#FEF2F2] text-[#DC2626]'
      case 'terminated':
        return 'border-[#9CA3AF]/20 bg-background text-muted-foreground'
      case 'rolled_back':
        return 'border-[#CA8A04]/20 bg-[#FEF9C3] text-[#CA8A04]'
      case 'pending':
      default:
        return 'border-[#CA8A04]/20 bg-[#FEF9C3] text-[#CA8A04]'
    }
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {isLoading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-36 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
            </div>
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-44 w-full rounded-md" />
            <Skeleton className="h-44 w-full rounded-md" />
            <Skeleton className="h-44 w-full rounded-md" />
            <Skeleton className="h-44 w-full rounded-md" />
          </div>
        </motion.div>
      ) : viewingRequest ? (
        <div className="space-y-6 text-left">
          <Button
            variant="ghost"
            onClick={() => setViewingRequest(null)}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-card p-0 h-auto space-x-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Requests</span>
          </Button>

          {/* Details header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold tracking-tight text-foreground m-0">
                  {viewingRequest.title}
                </h1>
                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider rounded-md border ${getStatusBadge(viewingRequest.status)}`}>
                  {viewingRequest.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Workflow: <span className="font-semibold text-foreground">{viewingRequest.workflow_name}</span>
              </p>
            </div>
            
            {/* Admin actions: Rollback dropdown */}
            {user?.role === 'admin' && viewingRequest.status === 'in_progress' && (
              <div className="flex items-center space-x-2">
                <Select onValueChange={(val: any) => setSelectedRollback(val)} value={selectedRollback}>
                  <SelectTrigger className="w-48 h-9 text-xs border-border bg-card rounded-md text-foreground">
                    <SelectValue placeholder="Rollback Options..." />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="previous_step" className="text-xs">Rollback to Previous Step</SelectItem>
                    <SelectItem value="beginning" className="text-xs">Rollback to Beginning</SelectItem>
                    <SelectItem value="terminate" className="text-xs text-danger font-bold">Terminate Request</SelectItem>
                  </SelectContent>
                </Select>
                {selectedRollback && (
                  <Button 
                    onClick={handleRollback}
                    className="h-9 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-none"
                  >
                    Confirm
                  </Button>
                )}
              </div>
            )}

            {viewingRequest.status === 'rejected' && (
              <Button 
                onClick={handleResubmit}
                className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center space-x-1.5 shrink-0 shadow-none"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Resubmit Request</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-6">
              {/* Request Data Card */}
              <Card className="border border-border bg-card rounded-md shadow-none overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Submitted Form Parameters</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide block">
                        Submitted By
                      </span>
                      <span className="text-xs font-semibold text-foreground flex items-center space-x-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{viewingRequest.submitted_by_username}</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide block">
                        Submission Priority
                      </span>
                      <span className="text-xs font-semibold text-foreground flex items-center space-x-1">
                        <AlertOctagon className={`h-3.5 w-3.5 ${viewingRequest.priority === 'critical' ? 'text-danger' : 'text-muted-foreground'}`} />
                        <span className="uppercase text-[10px] font-bold tracking-wider">{viewingRequest.priority}</span>
                      </span>
                    </div>
                  </div>
                  
                  {Object.entries(viewingRequest.data || {}).map(([key, val]) => (
                    <div key={key} className="space-y-1 mb-4 last:mb-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">
                        {key.replace('_', ' ')}
                      </span>
                      <div className="bg-background/50 p-3 rounded-md border border-border text-xs font-mono text-foreground break-words">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Timeline Sidebar */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block pl-2">
                Workflow Track Timeline
              </span>
              <ExecutionTimeline nodes={mapStageExecutionsToTimeline(viewingRequest.stage_executions || [], viewingRequest.current_stage)} />
            </div>
          </div>
        </div>
      ) : isCreating ? (
        <div className="space-y-6 text-left">
          <Button
            variant="ghost"
            onClick={() => {
              setIsCreating(false)
              setCreationStep(1)
              setSelectedWfId('')
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-card p-0 h-auto space-x-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Cancel</span>
          </Button>

          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardHeader className="border-b border-border p-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                Submit Approval Request
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                Step {creationStep} of 2
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {creationStep === 1 ? (
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Select approval template
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {workflows
                      .filter((w: any) => w.is_published)
                      .map((w: any) => (
                        <div
                          key={w.id}
                          id={`workflow-item-${w.id}`}
                          onClick={() => handleSelectWorkflow(w.id)}
                          className="p-3 border border-border bg-card hover:border-ring hover:bg-background/50 cursor-pointer rounded-md transition-colors flex items-center justify-between"
                        >
                          <div className="text-xs text-foreground font-bold">
                            {w.name}
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
                        </div>
                      ))}
                    {workflows.filter((w: any) => w.is_published).length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        No published workflows available. Publish a workflow first.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Request Title Summary
                    </Label>
                    <Input
                      id="input-req-title"
                      value={reqTitle}
                      onChange={(e) => setReqTitle(e.target.value)}
                      className="h-9 border-border rounded-md text-xs focus-visible:ring-[#1C1917]"
                      placeholder="e.g. Ergonomic Office Desk Purchase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Severity Priority Level
                    </Label>
                    <Select
                      defaultValue="medium"
                      onValueChange={(val: any) => setReqPriority(val)}
                    >
                      <SelectTrigger id="select-req-priority" className="h-9 border-border rounded-md text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border rounded-md">
                        <SelectItem value="low" className="focus:bg-background text-xs rounded-md">LOW</SelectItem>
                        <SelectItem value="medium" className="focus:bg-background text-xs rounded-md">MEDIUM</SelectItem>
                        <SelectItem value="high" className="focus:bg-background text-xs rounded-md">HIGH</SelectItem>
                        <SelectItem value="critical" className="focus:bg-background text-xs rounded-md">CRITICAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isFetchingFields ? (
                    <div className="space-y-4 pt-2 border-t border-border mt-4">
                      <Skeleton className="h-3 w-40 rounded-md mb-2" />
                      <div className="space-y-4">
                        <div className="space-y-1.5"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-9 w-full rounded-md" /></div>
                        <div className="space-y-1.5"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-9 w-full rounded-md" /></div>
                      </div>
                    </div>
                  ) : workflowFields.length > 0 ? (
                    <div className="space-y-4 pt-2 border-t border-border mt-4">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                        Dynamic Form Requirements
                      </Label>
                      {workflowFields.map((field) => (
                        <div key={field} className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                            {field.replace(/_/g, ' ')}
                          </Label>
                          <Input
                            id={`input-dynamic-${field}`}
                            value={formData[field] || ''}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className="h-9 border-border rounded-md text-xs focus-visible:ring-[#1C1917]"
                            placeholder={`Enter ${field}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-2 border-t border-border mt-4">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Additional Form Data (JSON)
                      </Label>
                      <Textarea
                        id="textarea-json"
                        value={formData.jsonStr !== undefined ? formData.jsonStr : ''}
                        onChange={(e) => setFormData({ ...formData, jsonStr: e.target.value })}
                        className="min-h-[100px] border-border rounded-md text-xs font-mono focus-visible:ring-[#1C1917]"
                        placeholder='{"amount": 5000}'
                      />
                      <p className="text-[9px] text-muted-foreground">Optional: Enter valid JSON for any additional workflow data.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-2 pt-4">
                    <Button
                      id="btn-back"
                      variant="outline"
                      onClick={() => setCreationStep(1)}
                      className="border-border text-foreground hover:bg-background rounded-md text-xs h-9 px-4"
                    >
                      Back
                    </Button>
                    <Button
                      id="btn-submit-request"
                      onClick={submitRequest}
                      disabled={submitMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 px-4 flex items-center space-x-1"
                    >
                      {submitMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <span>Submit Request</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Requests</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Monitor current and archived approval request pipelines
              </p>
            </div>
            
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 flex items-center space-x-1.5 shrink-0"
            >
              <span>Submit Request</span>
            </Button>
          </div>

          {/* Grid Layout of requests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card
                  onClick={() => setViewingRequest(req)}
                  className="border border-border bg-card rounded-md p-5 shadow-none hover:border-ring hover:bg-background/10 transition-all cursor-pointer flex flex-col justify-between h-44 text-left"
                >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-foreground truncate">{req.title}</span>
                    <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 shrink-0 ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold space-y-1">
                    <p>Workflow: <span className="text-foreground">{req.workflow_name}</span></p>
                    <p>Submitted by: <span className="text-foreground">{req.submitted_by_username}</span></p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 mt-3">
                  <span className="text-[10px] text-[#9CA3AF] font-medium">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</span>
                  <div className="flex items-center space-x-2 text-[10px] text-muted-foreground font-bold uppercase">
                    <span className="flex items-center">
                      <Briefcase className="h-3.5 w-3.5 mr-1" />
                      Priority: {req.priority}
                    </span>
                  </div>
                </div>
              </Card>
              </motion.div>
            ))}
            
            {requests.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-12 border border-dashed border-border bg-card rounded-md col-span-2">
                No submitted requests found.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

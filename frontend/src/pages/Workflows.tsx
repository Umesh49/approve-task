import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GitBranch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StagesTab } from '@/components/workflow/StagesTab';

import { RulesTab } from '@/components/workflow/RulesTab';
import { VersionHistoryTab } from '@/components/workflow/VersionHistoryTab';

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Workflow } from '@/types';
import { api } from '@/services/api';


















export function Workflows() {
  const queryClient = useQueryClient()
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)
  const [changelog, setChangelog] = useState('')
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)

  // 1. Fetch Workflow List
  const { data: workflows = [], isLoading: isLoadingList } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows/')
      return res.data.results || res.data
    }
  })

  // 2. Auto-select the first workflow when the list loads
  useEffect(() => {
    if (workflows.length > 0 && !activeWorkflowId) {
      setActiveWorkflowId(workflows[0].id)
    }
  }, [workflows, activeWorkflowId])

  // 3. Prefetch ALL workflow details in parallel the moment the list loads
  //    This fills React Query cache so clicking any workflow is instant (no spinner)
  const detailQueries = useQueries({
    queries: workflows.map((wf: any) => ({
      queryKey: ['workflows', wf.id],
      queryFn: async () => {
        const res = await api.get(`/api/workflows/${wf.id}/`)
        return res.data
      },
      enabled: workflows.length > 0,
      staleTime: 1000 * 60 * 5, // keep cached for 5 minutes
    }))
  })

  // Active workflow comes from the prefetched cache — instant on click
  const activeWorkflowDetail = detailQueries.find(
    (q) => (q.data as any)?.id === activeWorkflowId
  )?.data as any

  const isLoadingDetail = detailQueries.find(
    (q) => (q.data as any)?.id === activeWorkflowId
  )?.isLoading ?? (!!activeWorkflowId && !activeWorkflowDetail)

  const activeWorkflow = activeWorkflowDetail || workflows.find((w: any) => w.id === activeWorkflowId) || null

  const handleSelectWorkflow = (id: string) => {
    setActiveWorkflowId(id)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const uniqueName = `New Workflow ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`
      const res = await api.post('/api/workflows/', { name: uniqueName, description: '' })
      return res.data
    },
    onSuccess: (newWf) => {
      queryClient.setQueryData(['workflows'], (old: any) => [newWf, ...(old || [])])
      setActiveWorkflowId(newWf.id)
      toast.success('New draft workflow created')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.name?.[0] || err?.response?.data?.detail || 'Failed to create workflow'
      toast.error(msg)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/workflows/${id}/`)
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData(['workflows'], (old: any) => old?.filter((w: any) => w.id !== id))
      if (activeWorkflowId === id) setActiveWorkflowId(null)
      toast.success('Workflow deleted')
    },
    onError: () => toast.error('Failed to delete workflow')
  })

  const updateActiveWorkflow = (updated: Partial<Workflow>) => {
    if (!activeWorkflowId) return
    queryClient.setQueryData(['workflows', activeWorkflowId], (old: any) => old ? { ...old, ...updated } : old)
    queryClient.setQueryData(['workflows'], (oldList: any) => 
      oldList?.map((w: any) => w.id === activeWorkflowId ? { ...w, ...updated } : w)
    )
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/workflows/${activeWorkflowId}/sync/`, activeWorkflowDetail)
      return res.data
    },
    onSuccess: (data) => {
      updateActiveWorkflow(data)
      toast.success('Workflow saved to backend!')
    },
    onError: (err: any) => {
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || 'Failed to save workflow.'
      toast.error(`Save Error: ${errorMsg}`)
    }
  })

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/workflows/${activeWorkflowId}/unpublish/`)
      return res.data
    },
    onSuccess: (data) => {
      updateActiveWorkflow(data)
      toast.success('Reverted to draft')
    },
    onError: () => toast.error('Failed to revert')
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/workflows/${activeWorkflowId}/sync/`, activeWorkflowDetail)
      const res = await api.post(`/api/workflows/${activeWorkflowId}/publish/`, { changelog })
      return res.data
    },
    onSuccess: (data) => {
      updateActiveWorkflow(data)
      setIsPublishDialogOpen(false)
      toast.success('Workflow published successfully!')
    },
    onError: (err: any) => {
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.non_field_errors?.[0] || 'Failed to publish workflow.'
      toast.error(`Publish Error: ${errorMsg}`)
    }
  })

  if (isLoadingList) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-3 space-y-4">
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
          <div className="md:col-span-9">
            <Skeleton className="h-[600px] w-full rounded-md" />
          </div>
        </div>
      </div>
    )
  }
  const checkRulesValid = (rules: any[]): boolean => {
    if (!rules) return false;
    return rules.some((rule: any) => {
      if (rule.logical_operator && rule.children) {
        return checkRulesValid(rule.children);
      }
      return rule.action === 'route_to' && !rule.target_stage_id;
    });
  };
  const hasInvalidRules = checkRulesValid(activeWorkflow?.rules || []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Workflow Builder</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Design, version, and publish automated approval processes.
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 px-4 flex items-center space-x-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Blank Workflow</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Column: Workflow List */}
        <div className="xl:col-span-3 space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Library
          </h2>
          <div className="space-y-2">
            <AnimatePresence>
              {workflows.map((wf: any) => (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleSelectWorkflow(wf.id)}
                  className={`
                    p-3 rounded-md border cursor-pointer transition-all duration-200 relative group
                    ${
                      activeWorkflowId === wf.id
                        ? 'bg-primary border-ring'
                        : 'bg-card border-border hover:border-ring shadow-none'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 overflow-hidden pr-6">
                      <h3
                        className={`text-sm font-bold truncate ${
                          activeWorkflowId === wf.id ? 'text-primary-foreground' : 'text-foreground'
                        }`}
                      >
                        {wf.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className={`
                            text-[9px] font-bold uppercase tracking-wider rounded-md py-0 px-1.5
                            ${
                              wf.is_published
                                ? 'bg-[#16A34A]/20 text-[#16A34A] border-none'
                                : 'bg-[#FEF9C3] text-[#CA8A04] border-none'
                            }
                          `}
                        >
                          {wf.is_published ? 'Published' : 'Draft'}
                        </Badge>
                        <span
                          className={`text-[9px] font-bold tracking-wider ${
                            activeWorkflowId === wf.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          v{wf.current_version}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(wf.id);
                      }}
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-danger hover:bg-danger-light rounded-md"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {workflows.length === 0 && (
              <div className="text-center p-6 border border-dashed border-border rounded-md">
                <p className="text-xs text-[#9CA3AF]">No workflows found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Editor Workspace */}
        <div className="xl:col-span-9">
          {activeWorkflow ? (
            <Card className="border border-border bg-background/30 shadow-none rounded-md min-h-[700px] flex flex-col">
              <CardHeader className="border-b border-border bg-card px-6 py-5 rounded-t-[2px]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2 w-full max-w-xl">
                    <Input
                      value={activeWorkflow.name}
                      onChange={(e) => updateActiveWorkflow({ ...activeWorkflow, name: e.target.value })}
                      className="text-xl font-bold tracking-tight text-foreground h-10 px-2 -ml-2 bg-transparent border-transparent hover:border-border focus-visible:border-ring focus-visible:ring-0 rounded-md w-full"
                    />
                    <Input
                      value={activeWorkflow.description}
                      onChange={(e) => updateActiveWorkflow({ ...activeWorkflow, description: e.target.value })}
                      className="text-xs text-muted-foreground h-7 px-2 -ml-2 bg-transparent border-transparent hover:border-border focus-visible:border-ring focus-visible:ring-0 rounded-md w-full"
                      placeholder="Add a description for this workflow..."
                    />
                  </div>
                  
                    <div className="flex flex-col items-start md:items-end gap-2 shrink-0 w-full md:w-auto">
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending || hasInvalidRules}
                          variant="outline"
                          className="text-xs h-8 rounded-md flex items-center bg-card shadow-none flex-1 md:flex-none"
                        >
                          {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          Save Draft
                        </Button>
                        <Button
                          onClick={() => unpublishMutation.mutate()}
                          disabled={!activeWorkflow.is_published || saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending}
                          variant="outline"
                          className="text-xs h-8 border-border rounded-md flex items-center shadow-none flex-1 md:flex-none"
                        >
                          {unpublishMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          Unpublish
                        </Button>
                        <Button
                          onClick={() => setIsPublishDialogOpen(true)}
                          disabled={activeWorkflow.is_published || saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending || hasInvalidRules}
                          className="bg-success hover:bg-success/90 text-success-foreground font-bold text-xs h-8 rounded-md flex items-center shadow-none flex-1 md:flex-none"
                        >
                          {activeWorkflow.is_published ? 'Published' : 'Publish Version'}
                        </Button>
                      </div>
                      {activeWorkflow.is_published && (
                        <span className="text-[10px] text-muted-foreground w-full md:text-right mt-1">
                          Live v{activeWorkflow.current_version} is active for new requests.
                        </span>
                      )}
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-full md:text-right">
                        Last saved: {activeWorkflow.updated_at ? new Date(activeWorkflow.updated_at).toLocaleTimeString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  {isLoadingDetail || !activeWorkflow.stages ? (
                    <div className="flex-1 flex items-center justify-center h-full min-h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <Tabs defaultValue="stages" className="w-full flex-1 flex flex-col h-full rounded-md">
                      <div className="border-b border-border bg-card px-2 sm:px-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <TabsList className="bg-transparent h-12 p-0 space-x-6 justify-start w-max rounded-md min-w-full">
                      <TabsTrigger
                        value="stages"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ring rounded-md border-b-2 border-transparent px-1 pb-3 pt-3 font-bold text-xs uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
                      >
                        Approval Stages
                      </TabsTrigger>

                      <TabsTrigger
                        value="rules"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ring rounded-md border-b-2 border-transparent px-1 pb-3 pt-3 font-bold text-xs uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground"
                      >
                        Rules & Logic
                      </TabsTrigger>

                      <TabsTrigger
                        value="history"
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ring rounded-md border-b-2 border-transparent px-1 pb-3 pt-3 font-bold text-xs uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground ml-auto"
                      >
                        History
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="p-6 flex-1 overflow-auto">
                    <TabsContent value="stages" className="m-0 h-full data-[state=inactive]:hidden focus-visible:ring-0 focus-visible:outline-none">
                      <StagesTab workflow={activeWorkflow} setWorkflow={updateActiveWorkflow} />
                    </TabsContent>
                    


                    <TabsContent value="rules" className="m-0 h-full data-[state=inactive]:hidden focus-visible:ring-0 focus-visible:outline-none">
                      <RulesTab workflow={activeWorkflow} setWorkflow={updateActiveWorkflow} />
                    </TabsContent>



                    <TabsContent value="history" className="m-0 h-full data-[state=inactive]:hidden focus-visible:ring-0 focus-visible:outline-none">
                      <VersionHistoryTab workflow={activeWorkflow} />
                    </TabsContent>
                  </div>
                </Tabs>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-[700px] border border-dashed border-border rounded-md bg-card text-center p-8">
              <div className="h-16 w-16 bg-background rounded-full flex items-center justify-center mb-4">
                <GitBranch className="h-8 w-8 text-[#9CA3AF]" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">No Workflow Selected</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Select a workflow from the library on the left to start editing, or create a new blank workflow.
              </p>
              <Button
                onClick={() => createMutation.mutate()}
                className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 px-6 flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Workflow</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider text-foreground">Publish Workflow</DialogTitle>
            <DialogDescription className="text-xs">
              Enter a changelog description for this version. This will be visible in the version history timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="e.g. Added Finance approval stage for amounts over $5,000"
              className="resize-none text-xs"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-xs h-8" onClick={() => setIsPublishDialogOpen(false)} disabled={publishMutation.isPending}>Cancel</Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} className="text-xs h-8 bg-primary text-primary-foreground">
              {publishMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

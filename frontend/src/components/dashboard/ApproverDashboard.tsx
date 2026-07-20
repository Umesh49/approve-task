import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Clock, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedNumber } from './AnimatedNumber'
import { api } from '@/services/api'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore } from '@/stores/authStore'

export function ApproverDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [approvedCount, setApprovedCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await api.get('/api/requests/')
        const allReqs = res.data.results || res.data
        
        const actionable = allReqs.filter((r: any) => r.is_actionable)
        setPendingApprovals(actionable)
        
        const mine = allReqs.filter((r: any) => r.submitted_by_username === user?.username)
        setMyRequests(mine)
        
        const approved = allReqs.filter((r: any) => r.status === 'approved').length
        const rejected = allReqs.filter((r: any) => r.status === 'rejected' || r.status === 'terminated').length
        
        setApprovedCount(approved)
        setRejectedCount(rejected)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [user])

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    toast.success(`Request #${id} ${action === 'approve' ? 'Approved' : 'Rejected'} successfully!`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/25'
      case 'rejected':
      case 'terminated':
        return 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/25'
      case 'pending':
      default:
        return 'bg-[#FEF9C3] text-[#CA8A04] border-[#CA8A04]/25'
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-52 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
            </div>
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
          <Skeleton className="h-36 w-full rounded-md" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        </>
      ) : (
        <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Approver Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review your pending approvals and monitor your submitted requests
          </p>
        </div>
        <Button
          onClick={() => navigate('/requests?create=true')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 flex items-center space-x-1.5 shrink-0 shadow-none"
        >
          <Plus className="h-4 w-4" />
          <span>Submit New Request</span>
        </Button>
      </div>

      {/* Prominent count block */}
      <Card className="border border-border bg-card rounded-md p-6 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex px-2 py-0.5 bg-[#FEF9C3] border border-[#CA8A04]/20 text-[#CA8A04] text-[9px] font-bold uppercase tracking-wider rounded-md">
              Requires Attention
            </div>
            <h2 className="text-lg font-bold text-foreground m-0">
              You have {isLoading ? '...' : pendingApprovals.length} pending approvals waiting for your action
            </h2>
            <p className="text-xs text-muted-foreground">
              Review the details and comments to proceed. Failing to action within 48 hours will trigger alerts.
            </p>
          </div>
          <div className="flex space-x-6 shrink-0">
            <div className="border-l border-border pl-6">
              <span className="block text-2xl font-black text-foreground">
                {isLoading ? <span className="text-sm">...</span> : <AnimatedNumber value={approvedCount} />}
              </span>
              <span className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                Approved total
              </span>
            </div>
            <div className="border-l border-border pl-6">
              <span className="block text-2xl font-black text-foreground">
                {isLoading ? <span className="text-sm">...</span> : <AnimatedNumber value={rejectedCount} />}
              </span>
              <span className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                Rejected total
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List of Pending Approvals */}
        <Card className="border border-border bg-card rounded-md shadow-none flex flex-col h-[500px]">
          <CardHeader className="border-b border-border px-5 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                Action Items Queue
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center p-8 text-xs text-muted-foreground flex items-center justify-center h-full">
                No action items waiting for you.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-background/40 transition-colors"
                  >
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-foreground">{req.title}</span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1.5 uppercase font-bold tracking-wider ${getStatusBadge(req.priority)}`}>
                          {req.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-muted-foreground font-medium flex-wrap">
                        <span>Wf: {req.workflow_name}</span>
                        <span>•</span>
                        <span>By: {req.submitted_by_username}</span>
                        <span>•</span>
                        <span className="flex items-center text-[#CA8A04]">
                          <Clock className="h-3 w-3 mr-1" />
                          {req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : 'Recently'}
                        </span>
                      </div>
                    </div>

                    {/* Quick actions buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/requests/${req.id}`)}
                        className="border-border text-foreground hover:bg-background rounded-md text-xs h-8 px-3"
                        variant="outline"
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(req.id, 'approve')}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-xs h-8 px-3 shadow-none"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* List of My Requests */}
        <Card className="border border-border bg-card rounded-md shadow-none flex flex-col h-[500px]">
          <CardHeader className="border-b border-border px-5 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                My Submitted Requests
              </CardTitle>
              <Button
                variant="ghost"
                onClick={() => navigate('/requests')}
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground p-0 h-auto space-x-1"
              >
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myRequests.length === 0 ? (
              <div className="text-center p-8 text-xs text-muted-foreground flex items-center justify-center h-full">
                You haven't submitted any requests yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-background/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">#{req.id.substring(0,6)}</span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1.5 uppercase font-bold tracking-wider ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold text-foreground truncate m-0">
                        {req.title}
                      </h3>
                      <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-muted-foreground font-medium">
                        <span className="flex items-center">
                          <span className="font-semibold text-foreground mr-1">Wf:</span> {req.workflow_name || 'Workflow'}
                        </span>
                        {req.current_stage_name && req.status === 'pending' && (
                          <span className="flex items-center">
                            <span className="font-semibold text-foreground mr-1">Stage:</span> {req.current_stage_name}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] text-[#9CA3AF] flex items-center justify-end">
                          <Clock className="h-3 w-3 mr-1" />
                          {req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : 'Recently'}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        onClick={() => navigate(`/requests/${req.id}`)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  )
}

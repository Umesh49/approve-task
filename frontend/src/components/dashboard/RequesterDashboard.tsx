import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Plus, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedNumber } from './AnimatedNumber'
import { api } from '@/services/api'
import { formatDistanceToNow } from 'date-fns'

export function RequesterDashboard() {
  const navigate = useNavigate()
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await api.get('/api/requests/')
        // but for now we'll assume the backend returns the appropriate list or we just render them all since it's a demo.
        const reqs = res.data.results || res.data
        
        setMyRequests(reqs)
        setStats({
          pending: reqs.filter((r: any) => r.status === 'pending').length,
          approved: reqs.filter((r: any) => r.status === 'approved').length,
          rejected: reqs.filter((r: any) => r.status === 'rejected' || r.status === 'terminated').length
        })
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/25'
      case 'rejected':
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <Skeleton className="h-64 w-full rounded-md" />
        </>
      ) : (
        <>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">My Requests Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Submit approval requests and monitor their workflow execution stages
          </p>
        </div>
        
        {/* Submit New Request CTA */}
        <Button
          onClick={() => navigate('/requests?create=true')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 flex items-center space-x-1.5 shrink-0 shadow-none"
        >
          <Plus className="h-4 w-4" />
          <span>Submit New Request</span>
        </Button>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border bg-card rounded-md shadow-none p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending approvals</span>
            <span className="block text-2xl font-extrabold text-foreground">
              {isLoading ? <span className="text-sm">...</span> : <AnimatedNumber value={stats.pending} />}
            </span>
          </div>
          <div className="p-2 bg-[#FEF9C3] rounded-md text-[#CA8A04] shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </Card>
        
        <Card className="border border-border bg-card rounded-md shadow-none p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Successfully Approved</span>
            <span className="block text-2xl font-extrabold text-foreground">
              {isLoading ? <span className="text-sm">...</span> : <AnimatedNumber value={stats.approved} />}
            </span>
          </div>
          <div className="p-2 bg-[#F0FDF4] rounded-md text-[#16A34A] shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>
        
        <Card className="border border-border bg-card rounded-md shadow-none p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rejected / Terminated</span>
            <span className="block text-2xl font-extrabold text-foreground">
              {isLoading ? <span className="text-sm">...</span> : <AnimatedNumber value={stats.rejected} />}
            </span>
          </div>
          <XCircle className="h-6 w-6 text-[#DC2626]" />
        </Card>
      </div>

      {/* Recent requests list */}
      <Card className="border border-border bg-card rounded-md shadow-none">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
              My Request Timeline History
            </CardTitle>
            <Button
              variant="ghost"
              onClick={() => navigate('/requests')}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground p-0 h-auto space-x-1"
            >
              <span>View full list</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myRequests.length === 0 ? (
            <div className="text-center p-8 text-xs text-muted-foreground">
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
                    <div className="flex items-center space-x-3 mt-1.5 text-xs text-muted-foreground">
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
                    <div className="text-right">
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
        </>
      )}
    </div>
  )
}

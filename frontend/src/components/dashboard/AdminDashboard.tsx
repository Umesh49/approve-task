import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GitBranch, Activity, Plus, ClipboardList, UserCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedNumber } from './AnimatedNumber'
import { api } from '@/services/api'
import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

export function AdminDashboard() {
  const navigate = useNavigate()


  const [activities, setActivities] = useState<any[]>([])
  const [stats, setStats] = useState({ workflows: 0, requests: 0, approvals: 0, users: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wfRes, reqRes, auditRes, userRes] = await Promise.all([
          api.get('/api/workflows/'),
          api.get('/api/requests/'),
          api.get('/api/audit-logs/'),
          api.get('/api/auth/users/').catch(() => ({ data: [] }))
        ])
        
        const wfs = wfRes.data.results || wfRes.data || []
        const reqs = reqRes.data.results || reqRes.data || []
        const logs = auditRes.data.results || auditRes.data || []
        const usersList = userRes.data.results || userRes.data || []
        
        setStats({
          workflows: wfs.length,
          requests: reqs.length,
          approvals: reqs.filter((r: any) => r.status === 'pending').length,
          users: usersList.length
        })
        
        setActivities(logs.slice(0, 10).map((log: any) => {
          let text = log.description || ''
          
          if (text.includes('performed')) {
            let entityName = `#${log.entity_id || ''}`.substring(0, 7)
            const data = log.new_value || log.old_value || {}
            
            let parsedData = data
            try {
              if (typeof data === 'string') parsedData = JSON.parse(data)
            } catch {}

            if (parsedData?.title) entityName = `'${parsedData.title}'`
            else if (parsedData?.name) entityName = `'${parsedData.name}'`

            const actionMap: Record<string, string> = {
              'request_submitted': 'submitted',
              'request_approved': 'approved',
              'request_rejected': 'rejected',
              'request_terminated': 'terminated',
              'workflow_created': 'created',
              'workflow_published': 'published',
              'workflow_unpublished': 'unpublished',
              'workflow_deleted': 'deleted',
              'workflow_rolled_back': 'rolled back'
            }

            const actionWord = actionMap[log.action] || log.action.replace(/_/g, ' ')
            const entityTypeStr = (log.entity_type || '').replace(/_/g, ' ')
            
            const username = log.user_username || 'System'
            text = `${username} ${actionWord} ${entityTypeStr} ${entityName}`
          }

          text = text.charAt(0).toUpperCase() + text.slice(1)
          
          return {
            id: log.id,
            action: log.action,
            desc: text,
            time: log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }) : 'Just now',
            type: log.action.includes('approved') || log.action.includes('published') ? 'success' :
                  log.action.includes('rejected') || log.action.includes('terminated') ? 'danger' :
                  log.action.includes('rolled_back') ? 'warning' : 'system'
          }
        }))
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])


  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </motion.div>
    )
  }


  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">
            System overview, workflow analytics, and global audit activities
          </p>
        </div>
        
        {/* Quick Actions Bar */}
        <div className="flex items-center space-x-2 shrink-0">
          <Button
            onClick={() => navigate('/workflows')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs h-9 flex items-center space-x-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workflow</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/requests')}
            className="border-border text-foreground hover:bg-card rounded-md text-xs h-9"
          >
            <span>View All Requests</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Stats Cards with SVG Sparkline & Stagger Animation */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Card 1: Total Workflows */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardContent className="p-5 flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Workflows
                </span>
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-foreground">
                  <AnimatedNumber value={stats.workflows} />
                </span>
                {/* SVG Sparkline */}
                <div className="w-16 h-8 shrink-0">
                  <svg viewBox="0 0 60 30" className="w-full h-full">
                    <path
                      d="M0 25 L10 20 L20 28 L30 15 L40 18 L50 5 L60 8"
                      fill="none"
                      stroke="#1C1917"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                Workflows configured
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 2: Total Requests */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardContent className="p-5 flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Requests
                </span>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-foreground">
                  <AnimatedNumber value={stats.requests} />
                </span>
                <div className="w-16 h-8 shrink-0">
                  <svg viewBox="0 0 60 30" className="w-full h-full">
                    <path
                      d="M0 28 L10 25 L20 18 L30 22 L40 10 L50 14 L60 4"
                      fill="none"
                      stroke="#1C1917"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                All time requests
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 3: Pending Approvals */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardContent className="p-5 flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pending Approvals
                </span>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-foreground">
                  <AnimatedNumber value={stats.approvals} />
                </span>
                <div className="w-16 h-8 shrink-0">
                  <svg viewBox="0 0 60 30" className="w-full h-full">
                    <path
                      d="M0 10 L10 12 L20 5 L30 18 L40 15 L50 25 L60 22"
                      fill="none"
                      stroke="#78716C"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                Awaiting decisions
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 4: Active Users */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardContent className="p-5 flex flex-col justify-between h-32">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active Users
                </span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-extrabold text-foreground">
                  <AnimatedNumber value={stats.users} />
                </span>
                <div className="w-16 h-8 shrink-0">
                  <svg viewBox="0 0 60 30" className="w-full h-full">
                    <path
                      d="M0 29 L10 27 L20 28 L30 25 L40 24 L50 22 L60 20"
                      fill="none"
                      stroke="#78716C"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium">
                Using the platform
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Grid: Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity List (takes 2/3 cols) */}
        <Card className="lg:col-span-2 border border-border bg-card rounded-md shadow-none">
          <CardHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0 flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Recent Audit Activity</span>
              </CardTitle>
              <Badge variant="outline" className="rounded-md border-border text-muted-foreground text-[10px] font-bold uppercase">
                Live Feed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {activities.map((act) => {
                let statusColor = 'bg-muted text-muted-foreground border-border'
                if (act.type === 'success' || act.action.includes('published')) {
                  statusColor = 'bg-success-light text-success border-success/20'
                } else if (act.type === 'warning' || act.action.includes('rolled_back')) {
                  statusColor = 'bg-warning-light text-warning border-warning/20'
                } else if (act.type === 'danger' || act.action.includes('rejected') || act.action.includes('terminated')) {
                  statusColor = 'bg-danger-light text-danger border-danger/20'
                } else {
                  statusColor = 'bg-primary/10 text-primary border-primary/20'
                }

                return (
                  <div key={act.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-background/50 transition-colors">
                    <div className="flex items-center justify-between w-full sm:w-auto shrink-0">
                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-md ${statusColor}`}>
                        {act.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF] font-medium whitespace-nowrap sm:hidden">
                        {act.time}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-xs text-foreground leading-normal font-medium truncate">
                        {act.desc}
                      </p>
                    </div>
                    
                    <span className="text-[10px] text-[#9CA3AF] shrink-0 font-medium whitespace-nowrap hidden sm:block">
                      {act.time}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Help & Analytics Box */}
        <div className="space-y-4">
          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Backend Server</span>
                <span className="font-semibold text-[#16A34A] flex items-center space-x-1">
                  <span className="h-2 w-2 rounded-md bg-[#16A34A] inline-block" />
                  <span>Operational</span>
                </span>
              </div>

            </CardContent>
          </Card>

          <Card className="border border-border bg-card rounded-md shadow-none">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                Workflow Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                "When publishing a new workflow version, all pending requests are safely locked to their original snapshot version, preventing database schema mismatches."
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

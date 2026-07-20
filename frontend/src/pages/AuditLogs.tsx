import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Activity, Search, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface AuditLog {
  id: string
  action: string
  description: string
  user_username: string
  ip_address: string
  timestamp: string
  entity_id?: string
  entity_type?: string
  old_value?: string
  new_value?: string
}

export function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await api.get('/api/audit-logs/')
      return response.data.results || response.data
    }
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType])
  
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_username || '').toLowerCase().includes(searchTerm.toLowerCase())
      
    if (filterType === 'all') return matchesSearch
    return matchesSearch && log.action.includes(filterType)
  })

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getBadgeColor = (action: string) => {
    if (action.includes('approved') || action.includes('published')) return 'bg-success-light text-success border-success/20'
    if (action.includes('rejected') || action.includes('terminated')) return 'bg-danger-light text-danger border-danger/20'
    if (action.includes('rolled_back') || action.includes('pending')) return 'bg-warning-light text-warning border-warning/20'
    return 'bg-primary/10 text-primary border-primary/20'
  }
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Global Audit Log</h1>
          <p className="text-xs text-muted-foreground mt-1">Compliance history and immutable system trails.</p>
        </div>
      </div>

      <Card className="border border-border bg-card rounded-md shadow-none">
        <CardHeader className="border-b border-border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0 flex items-center space-x-2 shrink-0">
            <Activity className="h-4 w-4" />
            <span>Event Feed</span>
          </CardTitle>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#9CA3AF]" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs border-border bg-background focus-visible:ring-ring w-full"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={filterType !== 'all' ? 'default' : 'outline'} size="icon" className={`h-8 w-8 ${filterType === 'all' ? 'border-border' : ''}`}>
                  <Filter className={`h-3.5 w-3.5 ${filterType !== 'all' ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 border-border text-xs">
                <DropdownMenuItem onClick={() => setFilterType('all')} className="focus:bg-background focus:text-foreground text-xs rounded-md">All Events</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType('request')} className="focus:bg-background focus:text-foreground text-xs rounded-md">Requests</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType('workflow')} className="focus:bg-background focus:text-foreground text-xs rounded-md">Workflows</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType('stage')} className="focus:bg-background focus:text-foreground text-xs rounded-md">Stages</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 flex justify-center items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No audit logs found.
              </div>
            ) : (
              paginatedLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-start space-x-4 hover:bg-background/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border rounded-md shrink-0 ${getBadgeColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-semibold text-foreground">
                        {log.user_username || 'system'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal truncate">
                      {(() => {
                        if (log.description && !log.description.includes('performed')) {
                          return log.description
                        }

                        let entityName = `#${log.entity_id || ''}`.substring(0, 7)
                        const data = log.new_value || log.old_value || {}
                        
                        let parsedData: any = data
                        try {
                          if (typeof data === 'string') {
                            parsedData = JSON.parse(data)
                          }
                        } catch {}

                        if (parsedData?.title) {
                          entityName = `'${parsedData.title}'`
                        } else if (parsedData?.name) {
                          entityName = `'${parsedData.name}'`
                        }

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
                        
                        let result = `${actionWord} ${entityTypeStr} ${entityName}`
                        return result.charAt(0).toUpperCase() + result.slice(1)
                      })()}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF] shrink-0 font-medium whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
          
          {totalPages > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/50">
              <span className="text-xs text-muted-foreground font-medium">
                Showing {filteredLogs.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 text-xs border-border bg-card shadow-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Prev
                </Button>
                <div className="text-xs font-semibold px-2 text-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-7 text-xs border-border bg-card shadow-none"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

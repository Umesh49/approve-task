import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/services/api';
import type { Workflow } from '@/types';

interface VersionHistoryTabProps {
  workflow: Workflow
}

export function VersionHistoryTab({ workflow }: VersionHistoryTabProps) {
  const [selectedV1, setSelectedV1] = useState('')
  const [selectedV2, setSelectedV2] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [diffData, setDiffData] = useState<any>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)

  const diffVersions = [...versions, { id: 'v0', version_number: 0 }]

  const getVersionNumber = (id: string) => {
    const v = diffVersions.find(v => v.id === id);
    return v ? v.version_number : id;
  }

  useEffect(() => {
    const fetchVersions = async () => {
      if (workflow.id.startsWith('wf-')) {
        setVersions([])
        setIsLoading(false)
        return
      }
      try {
        const res = await api.get(`/api/workflows/${workflow.id}/versions/`)
        const data = res.data.results || res.data
        // sort by version_number descending
        data.sort((a: any, b: any) => b.version_number - a.version_number)
        setVersions(data)
        if (data.length >= 2) {
          setSelectedV1(data[1].id)
          setSelectedV2(data[0].id)
        } else if (data.length === 1) {
          setSelectedV1('v0')
          setSelectedV2(data[0].id)
        }
      } catch (err) {
        console.error('Failed to load versions', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchVersions()
  }, [workflow.id])

  useEffect(() => {
    if (selectedV1 && selectedV2) {
      setIsDiffLoading(true)
      api.get(`/api/workflows/${workflow.id}/versions/${selectedV1}/diff/${selectedV2}/`)
        .then(res => setDiffData(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsDiffLoading(false))
    }
  }, [selectedV1, selectedV2, workflow.id])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Immutable Version Snapshots
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Col: Timeline list */}
        <div className="md:col-span-4 space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#E7E5E4] before:to-transparent">
          {isLoading ? (
            <div className="flex justify-center p-8 z-10 relative">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center p-8 z-10 relative text-xs text-muted-foreground bg-card rounded-md border border-border">
              No published versions yet.
            </div>
          ) : versions.map((hist, idx) => (
            <div key={hist.id} className="relative pl-14 group is-active">
              {/* Timeline marker */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#FFFFFF] bg-primary text-[#FFFFFF] shadow z-10">
                <span className="text-xs font-bold">v{hist.version_number}</span>
              </div>
              
              {/* Timeline card */}
              <Card className="w-full border-border shadow-none hover:border-ring transition-colors bg-card rounded-md z-10">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">
                      {formatDistanceToNow(new Date(hist.published_at), { addSuffix: true })}
                    </span>
                    {idx === 0 && (
                      <Badge variant="outline" className="text-[8px] bg-[#FEF9C3] text-[#CA8A04] border-[#CA8A04]/20 rounded-md py-0 px-1 uppercase tracking-wider font-bold">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground font-medium leading-relaxed">
                    {hist.changelog || 'No changelog provided.'}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF]">
                    By {hist.published_by_username || 'system'}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Right Col: Diff View Tool */}
        <div className="md:col-span-8">
          <Card className="border border-border shadow-none bg-card rounded-md">
            <CardHeader className="border-b border-border px-5 py-4 bg-background/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground m-0">
                Schema Diff Compare
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="flex items-center justify-center space-x-4 opacity-50 pointer-events-none mb-6">
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Base</span>
                      <div className="w-24 h-8 text-xs font-bold border border-border rounded-md flex items-center justify-between px-3 bg-background text-foreground">
                        <span>v0</span>
                        <span className="opacity-50">▼</span>
                      </div>
                    </div>
                    
                    <div className="text-[#9CA3AF] mt-4 font-medium px-2">vs</div>
                    
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Compare</span>
                      <div className="w-24 h-8 text-xs font-bold border border-border rounded-md flex items-center justify-between px-3 bg-background text-foreground">
                        <span>v0</span>
                        <span className="opacity-50">▼</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Publish your first version to unlock schema diff comparison.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Base</span>
                      <Select value={selectedV1} onValueChange={setSelectedV1}>
                        <SelectTrigger className="w-24 h-8 text-xs font-bold border-border rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-md">
                          {diffVersions.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">v{v.version_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="text-[#9CA3AF] mt-4 font-medium px-2">vs</div>
                    
                    <div className="flex flex-col space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Compare</span>
                      <Select value={selectedV2} onValueChange={setSelectedV2}>
                        <SelectTrigger className="w-24 h-8 text-xs font-bold border-border rounded-md bg-[#FEF9C3] text-[#CA8A04] border-[#CA8A04]/20 hover:bg-[#FEF9C3]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-md">
                          {diffVersions.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">v{v.version_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-5 pl-4 border-l border-border">
                      <Button 
                        onClick={() => setIsComparing(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-4 rounded-md"
                      >
                        Compare
                      </Button>
                    </div>
                  </div>

                  {isComparing && (
                    <div className="border border-border rounded-md overflow-hidden">
                      <div className="bg-primary px-4 py-2 flex justify-between text-primary-foreground text-xs font-mono">
                        <span>Base: v{getVersionNumber(selectedV1)}</span>
                        <span>Target: v{getVersionNumber(selectedV2)}</span>
                      </div>
                      
                      <div className="p-0 text-xs font-mono leading-relaxed bg-[#FAFAFA]">
                        {!selectedV1 || !selectedV2 ? (
                          <div className="px-4 py-6 text-center text-[#9CA3AF] italic">
                            Select different versions to view diff.
                          </div>
                        ) : isDiffLoading ? (
                          <div className="px-4 py-6 text-center text-[#9CA3AF] italic">
                            Generating diff...
                          </div>
                        ) : selectedV1 === selectedV2 ? (
                          <div className="px-4 py-6 text-center text-[#9CA3AF] italic">
                            Nothing to show. The selected versions are identical.
                          </div>
                        ) : (
                          <div className="px-4 py-4 overflow-auto max-h-[300px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 transition-colors">
                            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(diffData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

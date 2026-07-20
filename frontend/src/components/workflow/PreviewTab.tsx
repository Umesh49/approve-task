import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Workflow } from '@/types';

interface PreviewTabProps {
  workflow: Workflow
}

export function PreviewTab({ workflow }: PreviewTabProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Request Submission Preview</h2>
        <p className="text-xs text-muted-foreground">
          This is how the form will appear to requesters
        </p>
      </div>

      <Card className="border border-border bg-card shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-md">
        <CardHeader className="border-b border-border px-6 py-5">
          <CardTitle className="text-lg font-bold text-foreground m-0">
            {workflow.name || 'Untitled Workflow'}
          </CardTitle>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-foreground">
                  Request Payload (JSON)
                </label>
                <textarea
                  className="w-full min-h-[150px] px-3 py-2 border border-border rounded-md bg-card text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={`{\n  "key": "value"\n}`}
                  disabled
                  value={`{\n  // Requesters will submit raw JSON data here\n  // Rules will match against these keys\n}`}
                />
              </div>
            </div>

          <div className="pt-6 border-t border-border flex justify-end">
            <Button disabled className="bg-primary text-primary-foreground rounded-md opacity-50 cursor-not-allowed flex items-center">
              <span>Submit Request</span>
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Execution Path Preview snippet */}
      <div className="mt-8 pt-8 border-t border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 text-center">
          Predicted Approval Path
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline" className="border-border bg-background text-foreground rounded-md text-[10px] py-1">
            Requester
          </Badge>
          {workflow.stages.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-[#9CA3AF]">→</span>
              <Badge variant="outline" className={`border-[1.5px] rounded-md text-[10px] py-1 ${s.is_skippable ? 'border-dashed border-[#CA8A04] text-[#CA8A04]' : 'border-ring text-foreground'}`}>
                {s.name}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { Plus, Trash2, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { Workflow, RuleNode } from '@/types';

interface RulesTabProps {
  workflow: Workflow
  setWorkflow: (wf: Workflow) => void
}

const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '==' },
  { value: 'neq', label: '!=' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'in', label: 'IN' },
  { value: 'not_in', label: 'NOT IN' },
]

const ACTIONS = [
  { value: 'skip_stage', label: 'Skip Stage' },
  { value: 'terminate', label: 'Terminate Request' },
]

interface RuleNodeProps {
  node: RuleNode
  onUpdate: (id: string, updates: Partial<RuleNode>) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, isGroup: boolean) => void
  isRoot?: boolean
}

function RuleNodeComponent({ node, onUpdate, onDelete, onAddChild, isRoot = false }: RuleNodeProps) {
  const isGroup = !!node.logical_operator

  if (isGroup) {
    return (
      <div className={`flex flex-col gap-2 ${!isRoot ? 'border-l-2 border-border pl-4 mt-2' : ''}`}>
        <div className="flex items-center gap-2">
          <Select
            value={node.logical_operator}
            onValueChange={(val: any) => onUpdate(node.id, { logical_operator: val })}
          >
            <SelectTrigger className="h-7 w-20 text-[10px] font-bold bg-secondary/50 border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND" className="text-[10px] font-bold">AND</SelectItem>
              <SelectItem value="OR" className="text-[10px] font-bold">OR</SelectItem>
            </SelectContent>
          </Select>

          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(node.id)}
              className="h-7 w-7 text-muted-foreground hover:text-danger hover:bg-danger-light rounded-md"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {(node.children || []).map((child) => (
            <RuleNodeComponent
              key={child.id}
              node={child}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
          
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddChild(node.id, false)}
              className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground border-dashed"
            >
              <Plus className="h-3 w-3 mr-1" /> Add Condition
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddChild(node.id, true)}
              className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground border-dashed"
            >
              <FolderGit2 className="h-3 w-3 mr-1" /> Add Group
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 w-full mt-1">
      <Input
        placeholder="Field (e.g. amount)"
        value={node.field_id || ''}
        onChange={(e) => onUpdate(node.id, { field_id: e.target.value })}
        className="h-8 text-xs border-border rounded-md flex-1 min-w-[120px]"
      />
      <Select
        value={node.operator || 'eq'}
        onValueChange={(val: any) => onUpdate(node.id, { operator: val })}
      >
        <SelectTrigger className="h-8 w-24 text-xs border-border rounded-md font-mono font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value} className="text-xs font-mono">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Value..."
        value={node.value || ''}
        onChange={(e) => onUpdate(node.id, { value: e.target.value })}
        className="h-8 text-xs border-border rounded-md flex-1 min-w-[120px]"
      />
      {!isRoot && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(node.id)}
          className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger-light rounded-md shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function RulesTab({ workflow, setWorkflow }: RulesTabProps) {
  
  const deepUpdate = (nodes: RuleNode[], id: string, updates: Partial<RuleNode>): RuleNode[] => {
    return nodes.map(n => {
      if (n.id === id) return { ...n, ...updates }
      if (n.children) return { ...n, children: deepUpdate(n.children, id, updates) }
      return n
    })
  }

  const deepDelete = (nodes: RuleNode[], id: string): RuleNode[] => {
    return nodes.filter(n => n.id !== id).map(n => {
      if (n.children) return { ...n, children: deepDelete(n.children, id) }
      return n
    })
  }

  const deepAddChild = (nodes: RuleNode[], parentId: string, newNode: RuleNode): RuleNode[] => {
    return nodes.map(n => {
      if (n.id === parentId) {
        return { ...n, children: [...(n.children || []), newNode] }
      }
      if (n.children) return { ...n, children: deepAddChild(n.children, parentId, newNode) }
      return n
    })
  }

  const addRootRule = () => {
    const newRoot: RuleNode = {
      id: `rule-${Date.now()}`,
      logical_operator: 'AND',
      children: [],
      action: 'skip_stage',
      target_stage_id: workflow.stages[0]?.id || '',
    }
    setWorkflow({ ...workflow, rules: [...(workflow.rules || []), newRoot] })
  }

  const handleUpdateNode = (id: string, updates: Partial<RuleNode>) => {
    setWorkflow({ ...workflow, rules: deepUpdate(workflow.rules || [], id, updates) })
  }

  const handleDeleteNode = (id: string) => {
    setWorkflow({ ...workflow, rules: deepDelete(workflow.rules || [], id) })
  }

  const handleAddChild = (parentId: string, isGroup: boolean) => {
    const newNode: RuleNode = isGroup
      ? { id: `rule-${Date.now()}`, logical_operator: 'AND', children: [] }
      : { id: `rule-${Date.now()}`, field_id: '', operator: 'eq', value: '' }
    setWorkflow({ ...workflow, rules: deepAddChild(workflow.rules || [], parentId, newNode) })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
            Business Logic Rules
          </span>
          <span className="text-[10px] text-muted-foreground">
            Define conditions to skip stages or auto-terminate requests. Supports nested AND/OR logic.
          </span>
        </div>
        <Button
          onClick={addRootRule}
          className="border-ring text-foreground hover:bg-background rounded-md text-xs h-8 px-3"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Add Rule Block</span>
        </Button>
      </div>

      <div className="space-y-4">
        {(!workflow.rules || workflow.rules.length === 0) && (
          <div className="text-center p-12 border border-dashed border-border bg-card rounded-md">
            <p className="text-xs text-muted-foreground font-medium">No custom rules defined.</p>
            <p className="text-[10px] text-[#9CA3AF] mt-1">Requests will follow the standard sequential stage order.</p>
          </div>
        )}

        {(workflow.rules || []).map((rule, idx) => (
          <div key={rule.id} className="bg-card border border-border rounded-md shadow-none flex flex-col relative overflow-hidden">
            {/* Header / Number */}
            <div className="bg-secondary/50 border-b border-border px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Rule Block {idx + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteNode(rule.id)}
                className="h-6 w-6 text-muted-foreground hover:text-danger hover:bg-danger-light rounded-md"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Tree Content */}
            <div className="p-4 bg-background/50">
              <RuleNodeComponent
                node={rule}
                onUpdate={handleUpdateNode}
                onDelete={handleDeleteNode}
                onAddChild={handleAddChild}
                isRoot={true}
              />
            </div>

            {/* THEN Action Block */}
            <div className="border-t border-border bg-card p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-xs font-bold text-foreground mr-1">THEN</span>
                <Select
                  value={rule.action || 'skip_stage'}
                  onValueChange={(val: any) => handleUpdateNode(rule.id, { action: val })}
                >
                  <SelectTrigger className="h-8 text-xs border-border rounded-md bg-background w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-xs text-[#CA8A04] font-bold">
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {rule.action === 'skip_stage' && (
                <div className="flex items-center shrink-0">
                  <Select
                    value={rule.target_stage_id || ''}
                    onValueChange={(val) => handleUpdateNode(rule.id, { target_stage_id: val })}
                  >
                    <SelectTrigger className={`h-8 text-xs border-border rounded-md bg-background w-40 ${!rule.target_stage_id ? 'border-danger/50 text-danger' : ''}`}>
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {workflow.stages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

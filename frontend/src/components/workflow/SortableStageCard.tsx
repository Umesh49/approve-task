import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

const MOCK_ROLES = ['admin', 'approver', 'requester'];
let cachedUsers: any[] | null = null;
let usersPromise: Promise<any[]> | null = null;

const fetchUsers = async () => {
  if (cachedUsers) return cachedUsers;
  if (usersPromise) return usersPromise;
  usersPromise = api.get('/api/auth/users/').then(res => {
    cachedUsers = res.data.results || res.data;
    return cachedUsers as any[];
  });
  return usersPromise;
};
import type { Stage } from '@/types';

interface SortableStageCardProps {
  stage: Stage
  index: number
  updateStage: (id: string, updates: Partial<Stage>) => void
  deleteStage: (id: string) => void
}

export function SortableStageCard({ stage, index, updateStage, deleteStage }: SortableStageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers().then(data => setUsers(data || []));
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-start space-x-3 bg-card border border-border p-4 rounded-md shadow-none z-10 text-left"
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="cursor-grab p-1 text-[#9CA3AF] hover:text-foreground shrink-0 mt-1">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-4">
        {/* Stage Name & Actions row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="h-6 w-6 bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center rounded-md">
              {index + 1}
            </span>
            <Input
              value={stage.name}
              onChange={(e) => updateStage(stage.id, { name: e.target.value })}
              className="font-bold text-sm text-foreground bg-transparent border-transparent hover:border-border focus-visible:border-ring focus-visible:ring-0 focus-visible:bg-card p-1 h-8 max-w-sm rounded-md transition-colors"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteStage(stage.id)}
            className="h-8 w-8 text-muted-foreground hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Inputs configuration row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Stage Type */}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Stage Action Type
            </Label>
            <Select
              value={stage.stage_type}
              onValueChange={(val: any) => updateStage(stage.id, { stage_type: val })}
            >
              <SelectTrigger className="h-8 text-xs border-border rounded-md bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border rounded-md">
                <SelectItem value="approval" className="focus:bg-background focus:text-foreground rounded-md text-xs">
                  Approval (Approve/Reject)
                </SelectItem>
                <SelectItem value="review" className="focus:bg-background focus:text-foreground rounded-md text-xs">
                  Review (Approve/Reject)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Approver Assignment Selector */}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Approver Selector
            </Label>
            <div className="flex space-x-1">
              <Select
                value={stage.approver_type}
                onValueChange={(val: 'role' | 'user') =>
                  updateStage(stage.id, {
                    approver_type: val,
                    approver_role: val === 'role' ? 'approver' : undefined,
                    specific_approver: undefined,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs border-border rounded-md bg-card shrink-0 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border rounded-md">
                  <SelectItem value="role" className="focus:bg-background focus:text-foreground rounded-md text-xs">
                    By Role
                  </SelectItem>
                  <SelectItem value="user" className="focus:bg-background focus:text-foreground rounded-md text-xs">
                    Specific User
                  </SelectItem>
                </SelectContent>
              </Select>

              {stage.approver_type === 'role' ? (
                <Select
                  value={stage.approver_role || undefined}
                  onValueChange={(val) => updateStage(stage.id, { approver_role: val })}
                >
                  <SelectTrigger className="h-8 text-xs border-border rounded-md bg-card w-full">
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent className="border-border rounded-md">
                    {MOCK_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="focus:bg-background focus:text-foreground rounded-md text-xs">
                        {r.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={stage.specific_approver || undefined}
                  onValueChange={(val) => updateStage(stage.id, { specific_approver: val })}
                >
                  <SelectTrigger className={`h-8 text-xs border-border rounded-md bg-card w-full ${!stage.specific_approver ? 'border-danger/50 text-danger' : ''}`}>
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent className="border-border rounded-md">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="focus:bg-background focus:text-foreground rounded-md text-xs">
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

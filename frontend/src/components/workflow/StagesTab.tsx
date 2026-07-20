import { GitBranch } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableStageCard } from './SortableStageCard';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Workflow, Stage } from '@/types';

interface StagesTabProps {
  workflow: Workflow
  setWorkflow: (wf: Workflow) => void
}

export function StagesTab({ workflow, setWorkflow }: StagesTabProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = workflow.stages.findIndex((s) => s.id === active.id)
    const newIndex = workflow.stages.findIndex((s) => s.id === over.id)

    const reordered = arrayMove(workflow.stages, oldIndex, newIndex).map(
      (stage, idx) => ({ ...stage, order: idx + 1 })
    )

    setWorkflow({ ...workflow, stages: reordered })
  }

  const addStage = () => {
    const newStage: Stage = {
      id: `st-${Date.now()}`,
      name: `Stage ${workflow.stages.length + 1}`,
      order: workflow.stages.length + 1,
      approver_type: 'role',
      approver_role: 'approver',
      is_skippable: false,
      stage_type: 'approval',
    }
    setWorkflow({ ...workflow, stages: [...workflow.stages, newStage] })
  }

  const deleteStage = (id: string) => {
    const filtered = workflow.stages
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order: idx + 1 }))
    setWorkflow({ ...workflow, stages: filtered })
  }

  const updateStage = (id: string, updates: Partial<Stage>) => {
    const updated = workflow.stages.map((s) => {
      if (s.id === id) {
        return { ...s, ...updates }
      }
      return s
    })
    setWorkflow({ ...workflow, stages: updated })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Workflow Stage Pipeline
        </span>
        <Button
          onClick={addStage}
          className="border-ring text-foreground hover:bg-background rounded-md text-xs h-8 px-3"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Add Stage</span>
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={(workflow.stages || []).map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4 relative">
            {(workflow.stages || []).map((stage: any, index: number) => (
              <div key={stage.id} className="relative">
                {/* Visual Connector Line between Stages */}
                {index < (workflow.stages || []).length - 1 && (
                  <div className="absolute left-8 top-16 bottom-[-16px] w-[2px] bg-secondary z-0" />
                )}
                
                <SortableStageCard
                  stage={stage}
                  index={index}
                  updateStage={updateStage}
                  deleteStage={deleteStage}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {workflow.stages.length === 0 && (
        <div className="text-center p-12 border border-dashed border-border bg-card rounded-md">
          <GitBranch className="h-8 w-8 mx-auto text-[#9CA3AF] mb-2" />
          <p className="text-xs text-muted-foreground font-medium">No stages configured yet</p>
          <Button onClick={addStage} className="bg-primary text-primary-foreground text-xs mt-3 h-8 rounded-md">
            Add First Stage
          </Button>
        </div>
      )}
    </div>
  )
}

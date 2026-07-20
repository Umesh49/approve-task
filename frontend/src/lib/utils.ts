import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mapStageExecutionsToTimeline(stageExecutions: any[], currentStageId: string | null) {
  if (!stageExecutions || !Array.isArray(stageExecutions)) return [];
  
  return stageExecutions.map((exec) => {
    let mappedStatus = exec.status;
    if (exec.status === 'approved') mappedStatus = 'completed';
    if (exec.status === 'pending') {
      if (currentStageId && exec.stage === currentStageId) {
        mappedStatus = 'current';
      }
    }
    
    return {
      id: exec.id,
      name: exec.stage_name,
      status: mappedStatus as any,
      assigned_to: exec.assigned_to_username,
      acted_by: exec.acted_by_username,
      acted_at: exec.acted_at,
      comments: exec.comments,
    };
  });
}

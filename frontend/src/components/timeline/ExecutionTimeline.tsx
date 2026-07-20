import { motion } from 'framer-motion'
import {
  CheckSquare,
  Square,
  FastForward,
  XSquare,
  RotateCcw,
  Clock,
} from 'lucide-react'

export interface TimelineNode {
  id: string
  name: string
  status: 'completed' | 'current' | 'skipped' | 'rejected' | 'rolled_back' | 'pending'
  assigned_to?: string
  acted_by?: string
  comments?: string
  skipped_reason?: string
  timestamp?: string
}

interface ExecutionTimelineProps {
  nodes: TimelineNode[]
}

export function ExecutionTimeline({ nodes = [] }: ExecutionTimelineProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const nodeVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative pl-8 space-y-6 text-left"
    >
      {/* Central Connector Line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-secondary z-0" />

      {nodes.map((node, index) => {
        let BoxIcon = Square
        let iconColor = 'text-[#9CA3AF]'
        let borderColor = 'border-border'
        let bgStyle = 'bg-card'
        let isPulsing = false

        switch (node.status) {
          case 'completed':
            BoxIcon = CheckSquare
            iconColor = 'text-[#16A34A]'
            borderColor = 'border-[#16A34A]/30'
            bgStyle = 'bg-[#F0FDF4]'
            break
          case 'current':
            BoxIcon = Square
            iconColor = 'text-[#3B82F6]'
            borderColor = 'border-[#3B82F6]'
            bgStyle = 'bg-[#EFF6FF]'
            isPulsing = true
            break
          case 'skipped':
            BoxIcon = FastForward
            iconColor = 'text-muted-foreground'
            borderColor = 'border-border'
            bgStyle = 'bg-background'
            break
          case 'rejected':
            BoxIcon = XSquare
            iconColor = 'text-[#DC2626]'
            borderColor = 'border-[#DC2626]/30'
            bgStyle = 'bg-[#FEF2F2]'
            break
          case 'rolled_back':
            BoxIcon = RotateCcw
            iconColor = 'text-[#CA8A04]'
            borderColor = 'border-[#CA8A04]/30'
            bgStyle = 'bg-[#FEF9C3]'
            break
          case 'pending':
          default:
            BoxIcon = Square
            iconColor = 'text-[#9CA3AF]'
            borderColor = 'border-border'
            bgStyle = 'bg-card'
            break
        }

        return (
          <motion.div
            key={node.id || index}
            variants={nodeVariants}
            className="relative flex items-start space-x-4 z-10"
          >
            {/* Square Node Box Icon */}
            <div className="absolute left-[-32px] top-1 shrink-0 bg-background">
              {isPulsing ? (
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex h-8 w-8 items-center justify-center border border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6] rounded-md"
                >
                  <Clock className="h-4.5 w-4.5 animate-pulse" />
                </motion.div>
              ) : (
                <div className={`flex h-8 w-8 items-center justify-center border ${borderColor} ${bgStyle} ${iconColor} rounded-md`}>
                  <BoxIcon className="h-4.5 w-4.5" />
                </div>
              )}
            </div>

            {/* Step Detail Content Card */}
            <div className="flex-1 border border-border bg-card p-4 rounded-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="font-bold text-xs text-foreground">
                  {node.name}
                </span>
                {node.timestamp && (
                  <span className="text-[10px] text-[#9CA3AF] font-medium">
                    {node.timestamp}
                  </span>
                )}
              </div>

              {/* Status details */}
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {node.status === 'completed' && node.acted_by && (
                  <p>Approved by <span className="font-semibold text-foreground">{node.acted_by}</span></p>
                )}
                {node.status === 'current' && node.assigned_to && (
                  <p>Assigned to <span className="font-semibold text-foreground">{node.assigned_to}</span> (Waiting for action)</p>
                )}
                {node.status === 'rejected' && node.acted_by && (
                  <p>Rejected by <span className="font-semibold text-foreground">{node.acted_by}</span></p>
                )}
                {node.status === 'skipped' && node.skipped_reason && (
                  <p className="italic text-[11px] text-muted-foreground bg-background p-2 border border-border rounded-md">
                    Skipped: {node.skipped_reason}
                  </p>
                )}
                {node.status === 'rolled_back' && (
                  <p className="text-[#CA8A04]">Rolled back to previous step</p>
                )}
                {node.status === 'pending' && (
                  <p className="text-[#9CA3AF] italic">Pending previous approvals</p>
                )}

                {/* Approver comments */}
                {node.comments && (
                  <p className="mt-2 text-[11px] text-foreground bg-background p-2.5 border-l-2 border-ring rounded-md-r-[2px] leading-relaxed">
                    "{node.comments}"
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

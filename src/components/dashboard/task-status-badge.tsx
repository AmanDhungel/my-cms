import { cn } from "cn"

import type { TaskStatus } from "@/lib/work-constants"

/**
 * The style guide's rule holds here too: colour never travels alone, so every
 * pill carries its label. The vocabulary is the task model's, not the landing
 * page's — those are different lists that happen to share some words.
 */
const LOOK: Record<TaskStatus, { label: string; dot: string; pulse?: boolean }> =
  {
    pending: { label: "Pending", dot: "bg-s-pending" },
    in_progress: { label: "In progress", dot: "bg-s-progress", pulse: true },
    in_review: { label: "In review", dot: "bg-s-time" },
    blocked: { label: "Blocked", dot: "bg-s-material" },
    done: { label: "Completed", dot: "bg-s-done" },
    cancelled: { label: "Cancelled", dot: "bg-n-400" },
  }

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus
  className?: string
}) {
  const look = LOOK[status]

  return (
    <span
      className={cn(
        "bg-n-100 text-n-800 inline-flex shrink-0 items-center gap-[7px] rounded-full py-1.5 pr-3 pl-2.5 text-[12.5px] font-medium",
        className
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span aria-hidden className={cn("size-2 rounded-full", look.dot)} />
        {look.pulse ? (
          <span
            aria-hidden
            className="border-s-progress absolute -inset-[5px] rounded-full border-[1.5px] [animation:ems-dot-pulse_1.8s_ease-out_infinite]"
          />
        ) : null}
      </span>
      {look.label}
    </span>
  )
}

export const PRIORITY_LOOK = {
  normal: "text-n-500 bg-n-100",
  high: "text-a-700 bg-a-50",
  critical: "text-s-overdue bg-[#fdecec]",
} as const

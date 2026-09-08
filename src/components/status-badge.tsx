import { cn } from "cn"

import {
  TASK_STATUS_DOT,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/task-status"

/**
 * Style guide spec: pill on neutral-100, 8px dot, always with its text label.
 * `pulse` adds the halo the guide puts on live work.
 */
export function StatusBadge({
  status,
  pulse = false,
  className,
}: {
  status: TaskStatus
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "bg-n-100 text-n-800 inline-flex items-center gap-[7px] rounded-full py-1.5 pr-3 pl-2.5 text-[13px] font-medium",
        className
      )}
    >
      <span className="relative flex size-2 shrink-0">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", TASK_STATUS_DOT[status])}
        />
        {pulse ? (
          <span
            aria-hidden
            className="border-s-progress absolute -inset-[5px] rounded-full border-[1.5px] [animation:ems-dot-pulse_1.8s_ease-out_infinite]"
          />
        ) : null}
      </span>
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}

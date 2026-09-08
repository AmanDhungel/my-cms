import { cn } from "cn"

import { StatusBadge } from "@/components/status-badge"
import type { TaskStatus } from "@/lib/task-status"

export type Task = {
  id: string
  title: string
  location: string
  /** Owner initials for the avatar. */
  owner: string
  status: TaskStatus
  deadline: string
  /** Geofence result. Absent until the owner has actually checked in. */
  checkIn?: string
}

/**
 * The "applied" card from the style guide: what an owner sees on their
 * dashboard. Colour stays in the badge and the dot; the surface stays neutral.
 */
export function TaskCard({
  task,
  className,
}: {
  task: Task
  className?: string
}) {
  return (
    <article
      className={cn(
        "border-n-200 w-full max-w-[440px] rounded-2xl border bg-white p-6 shadow-lg",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading mb-1 text-[17px] leading-snug font-semibold">
            {task.title}
          </p>
          <div className="text-n-500 flex items-center gap-[5px] text-[13px]">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="shrink-0"
            >
              <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {task.location}
          </div>
        </div>
        <span
          aria-hidden
          className="bg-p-100 text-p-700 font-heading flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {task.owner}
        </span>
      </div>

      <div className="mt-3.5">
        <StatusBadge status={task.status} pulse={task.status === "progress"} />
      </div>

      {task.checkIn ? (
        <div className="text-p-600 mt-3 flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="border-p-400 size-2.5 shrink-0 rounded-full border-[1.5px]"
          />
          {task.checkIn}
        </div>
      ) : null}

      <div className="border-n-200 mt-4 flex gap-4 border-t border-dashed pt-4">
        <span className="text-n-600 flex items-center gap-1.5 text-[12.5px]">
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Deadline {task.deadline}
        </span>
        <span className="text-n-600 font-mono text-[12.5px]">{task.id}</span>
      </div>
    </article>
  )
}

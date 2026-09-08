"use client"

import * as React from "react"
import { cn } from "cn"

import { PlusIcon } from "@/components/dashboard/nav-icons"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import { TaskDialog } from "@/components/dashboard/tasks/task-dialog"
import { TaskStatusBadge } from "@/components/dashboard/task-status-badge"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { formatDistance } from "@/lib/geo"
import { useTasks, type TaskScope } from "@/lib/queries"

const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
]

export function TasksView({
  canAssign,
  timeZone,
}: {
  canAssign: boolean
  timeZone: string
}) {
  const [scope, setScope] = React.useState<TaskScope>("today")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const query = useTasks(scope)
  const tasks = query.data?.tasks ?? []

  const counts = {
    open: tasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    ).length,
    onSite: tasks.filter((t) => t.checkedInAt).length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="All tasks"
        subtitle="Every located task, with the check-in area the crew has to be inside."
        actions={
          canAssign ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New task
            </button>
          ) : null
        }
      />

      {query.isPending ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="OPEN" value={counts.open} />
          <StatCard label="ON SITE NOW" value={counts.onSite} />
          <StatCard
            label="BLOCKED"
            value={counts.blocked}
            accent={counts.blocked > 0}
          />
          <StatCard label="COMPLETED" value={counts.done} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setScope(chip.value)}
            aria-pressed={scope === chip.value}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
              scope === chip.value
                ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load tasks. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          message={
            scope === "done"
              ? "Nothing finished in this view yet."
              : "No tasks here. Assign one with a site, a time window and a check-in radius."
          }
          action={
            canAssign ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className={primaryButtonClass}
              >
                New task
              </button>
            ) : undefined
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.5fr_150px_180px_150px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["TASK / SITE", "ASSIGNEE", "WINDOW", "STATUS"].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {tasks.map((task) => (
            <div
              key={task.id}
              className="border-n-200/70 hover:bg-n-50 grid gap-2.5 border-b px-[18px] py-3.5 last:border-b-0 lg:grid-cols-[1.5fr_150px_180px_150px] lg:items-center lg:gap-3.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">
                  {task.title}
                </span>
                <span className="text-n-500 text-[12.5px]">
                  {task.project?.name ? `${task.project.name} · ` : ""}
                  {task.site} · fence {formatDistance(task.radiusM)}
                </span>
                {task.blockedReason ? (
                  <span className="text-a-700 text-[12px]">
                    Blocked: {task.blockedReason}
                  </span>
                ) : null}
              </div>

              <span className="text-n-700 truncate text-[13px]">
                {task.assignee?.name || "Unassigned"}
              </span>

              <span className="text-n-600 font-mono text-[12px]">
                {dateLabel(task.startAt, timeZone)} ·{" "}
                {clock(task.startAt, timeZone)}–{clock(task.endAt, timeZone)}
              </span>

              <div className="flex flex-col items-start gap-1">
                <TaskStatusBadge status={task.status} />
                {task.checkedInAt ? (
                  <span className="text-p-600 font-mono text-[10.5px]">
                    ON SITE SINCE {clock(task.checkedInAt, timeZone)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </Panel>
      )}

      {canAssign ? (
        <TaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      ) : null}
    </DashboardMain>
  )
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function dateLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
  })
    .format(new Date(iso))
    .toUpperCase()
}

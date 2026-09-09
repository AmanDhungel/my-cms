"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { PinIcon } from "@/components/dashboard/nav-icons"
import { initialsOf } from "@/components/dashboard/viewer"
import { reportMutationError, useMoveTask } from "@/lib/queries"
import type { TaskStatus } from "@/lib/work-constants"
import type { TaskDTO } from "@/models/task"

/**
 * The four stages of the board. `blocked` isn't one of them — blocked work has
 * started, so it sits in "In progress" wearing a marigold flag rather than
 * disappearing into a column of its own.
 */
type Column = {
  status: Extract<TaskStatus, "pending" | "in_progress" | "in_review" | "done">
  label: string
  hint: string
  accent: string
}

const COLUMNS: Column[] = [
  {
    status: "pending",
    label: "Listed",
    hint: "Assigned, not started",
    accent: "bg-s-pending",
  },
  {
    status: "in_progress",
    label: "In progress",
    hint: "Being worked on",
    accent: "bg-s-progress",
  },
  {
    status: "in_review",
    label: "In review",
    hint: "Waiting on your sign-off",
    accent: "bg-s-time",
  },
  {
    status: "done",
    label: "Completed",
    hint: "Signed off",
    accent: "bg-s-done",
  },
]

function labelOf(status: Column["status"]) {
  return COLUMNS.find((column) => column.status === status)?.label ?? status
}

function columnOf(task: TaskDTO): Column["status"] | null {
  if (task.status === "cancelled") return null
  // Blocked work belongs beside the rest of the work in flight.
  if (task.status === "blocked") return "in_progress"
  return task.status
}

export function TaskBoard({
  tasks,
  timeZone,
  canMove,
  onEdit,
}: {
  tasks: TaskDTO[]
  timeZone: string
  canMove: boolean
  onEdit: (task: TaskDTO) => void
}) {
  const [dragging, setDragging] = React.useState<TaskDTO | null>(null)
  const [over, setOver] = React.useState<Column["status"] | null>(null)
  const [moving, setMoving] = React.useState<string | null>(null)
  const move = useMoveTask()

  function moveTo(task: TaskDTO, status: Column["status"]) {
    setDragging(null)
    setOver(null)
    if (!canMove || columnOf(task) === status || move.isPending) return

    setMoving(task.id)
    move.mutate(
      { id: task.id, status },
      {
        onSuccess: () => toast.success(`Moved to ${labelOf(status)}`),
        onError: (error) => reportMutationError(error),
        onSettled: () => setMoving(null),
      }
    )
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-4 lg:items-start">
      {COLUMNS.map((column) => {
        const cards = tasks.filter((task) => columnOf(task) === column.status)
        const isTarget =
          canMove &&
          over === column.status &&
          dragging !== null &&
          columnOf(dragging) !== column.status

        return (
          <section
            key={column.status}
            onDragOver={(event) => {
              if (!canMove || !dragging) return
              // Without this the browser refuses the drop.
              event.preventDefault()
              setOver(column.status)
            }}
            onDragLeave={() => setOver((at) => (at === column.status ? null : at))}
            onDrop={(event) => {
              event.preventDefault()
              setOver(null)
              if (dragging) void moveTo(dragging, column.status)
            }}
            className={cn(
              "border-n-200 bg-n-100/60 flex min-h-[160px] flex-col gap-2.5 rounded-[14px] border p-3 transition-colors",
              isTarget && "border-p-400 bg-p-50"
            )}
          >
            <header className="flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", column.accent)}
                />
                <span className="text-[13.5px] font-semibold">
                  {column.label}
                </span>
              </span>
              <span className="text-n-500 font-mono text-[11px]">
                {cards.length}
              </span>
            </header>
            <p className="text-n-400 m-0 -mt-1.5 px-1 text-[11.5px]">
              {column.hint}
            </p>

            {cards.length === 0 ? (
              <p className="border-n-300 text-n-400 m-0 rounded-[10px] border border-dashed px-3 py-6 text-center text-[12.5px]">
                Nothing here
              </p>
            ) : (
              cards.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  timeZone={timeZone}
                  canMove={canMove}
                  busy={moving === task.id}
                  onMove={(status) => moveTo(task, status)}
                  onEdit={() => onEdit(task)}
                  onDragStart={() => setDragging(task)}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                />
              ))
            )}
          </section>
        )
      })}
    </div>
  )
}

function Card({
  task,
  timeZone,
  canMove,
  busy,
  onEdit,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  task: TaskDTO
  timeZone: string
  canMove: boolean
  busy: boolean
  onEdit: () => void
  onMove: (status: Column["status"]) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const blocked = task.status === "blocked"
  const pending = busy
  const here = columnOf(task)

  return (
    <article
      draggable={canMove && !pending}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-2 rounded-[10px] border bg-white p-3 transition-[opacity,box-shadow]",
        blocked ? "border-a-400" : "border-n-200",
        canMove && !pending && "cursor-grab active:cursor-grabbing",
        pending && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13.5px] leading-snug font-semibold">
          {task.title}
        </span>
        {task.priority !== "normal" ? (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] uppercase",
              task.priority === "critical"
                ? "text-s-overdue bg-[#fdecec]"
                : "text-a-700 bg-a-50"
            )}
          >
            {task.priority}
          </span>
        ) : null}
      </div>

      <span className="text-n-500 flex items-center gap-1.5 text-[12px]">
        <PinIcon className="size-3 shrink-0" />
        <span className="truncate">
          {task.project?.name ? `${task.project.name} · ` : ""}
          {task.site}
        </span>
      </span>

      {blocked ? (
        <span className="text-a-700 bg-a-50 rounded px-2 py-1 text-[11.5px] leading-snug">
          Blocked{task.blockedReason ? `: ${task.blockedReason}` : ""}
        </span>
      ) : null}

      <div className="border-n-200 flex items-center justify-between gap-2 border-t pt-2">
        <span className="flex min-w-0 items-center gap-1">
          {task.assignees.length === 0 ? (
            <span className="text-n-400 text-[12px]">Unassigned</span>
          ) : (
            <>
              {task.assignees.slice(0, 3).map((member) => (
                <span
                  key={member.id}
                  title={member.name}
                  className={cn(
                    "font-heading flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold",
                    task.onSite.some((entry) => entry.id === member.id)
                      ? "bg-p-500 text-white"
                      : "bg-n-100 text-n-600"
                  )}
                >
                  {initialsOf(member.name)}
                </span>
              ))}
              {task.assignees.length > 3 ? (
                <span className="text-n-500 ml-0.5 font-mono text-[10.5px]">
                  +{task.assignees.length - 3}
                </span>
              ) : null}
            </>
          )}
        </span>
        <span className="text-n-400 shrink-0 font-mono text-[10.5px]">
          {clock(task.startAt, timeZone)}
        </span>
      </div>

      {task.onSite.length > 0 ? (
        <span className="text-p-600 font-mono text-[10.5px]">
          {task.onSite.length} ON SITE ·{" "}
          {clock(
            task.onSite.reduce((first, entry) =>
              entry.at < first.at ? entry : first
            ).at,
            timeZone
          )}
        </span>
      ) : null}

      {canMove ? (
        <div className="flex items-center gap-1.5">
          {/* Dragging doesn't exist on touch, so the same move is always
              available as a plain select. */}
          <label className="sr-only" htmlFor={`move-${task.id}`}>
            Move {task.title}
          </label>
          <select
            id={`move-${task.id}`}
            value={here ?? ""}
            disabled={pending}
            onChange={(event) =>
              onMove(event.target.value as Column["status"])
            }
            className="border-n-300 text-n-700 min-w-0 flex-1 cursor-pointer rounded-md border bg-white px-2 py-1 text-[12px] font-semibold disabled:opacity-60"
          >
            {COLUMNS.map((option) => (
              <option key={option.status} value={option.status}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onEdit}
            className="border-n-300 text-n-700 hover:bg-n-100 shrink-0 rounded-md border bg-white px-2.5 py-1 text-[12px] font-semibold"
          >
            Edit
          </button>
        </div>
      ) : null}
    </article>
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

"use client"

import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MapPicker } from "@/components/dashboard/map-picker"
import { TaskStatusBadge } from "@/components/dashboard/task-status-badge"
import { initialsOf } from "@/components/dashboard/viewer"
import { formatDistance } from "@/lib/geo"
import type { TaskDTO } from "@/models/task"

/** Read-only view of everything the task already carries. Fetches nothing. */
export function TaskDetailDialog({
  task,
  timeZone,
  open,
  onClose,
}: {
  task: TaskDTO
  timeZone: string
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[560px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {task.title}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {task.project?.name ? `${task.project.name} · ` : ""}
            {task.site}
          </DialogDescription>
        </DialogHeader>

        {open ? <Body task={task} timeZone={timeZone} /> : null}

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Close
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`}
            target="_blank"
            rel="noreferrer"
            className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            Get directions
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Body({ task, timeZone }: { task: TaskDTO; timeZone: string }) {
  return (
    <div className="flex max-h-[62vh] flex-col gap-3.5 overflow-auto pr-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <TaskStatusBadge status={task.status} />
        {task.priority !== "normal" ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] uppercase",
              task.priority === "critical"
                ? "text-s-overdue bg-[#fdecec]"
                : "text-a-700 bg-a-50"
            )}
          >
            {task.priority}
          </span>
        ) : null}
      </div>

      {task.description ? (
        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          {task.description}
        </p>
      ) : null}

      {task.blockedReason ? (
        <p className="border-a-400 bg-a-50 text-a-900 m-0 rounded-md border-l-2 px-3 py-2 text-[12.5px] leading-relaxed">
          Blocked: {task.blockedReason}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Fact label="Window">
          {clock(task.startAt, timeZone)}–{clock(task.endAt, timeZone)} ·{" "}
          {dateLabel(task.startAt, timeZone)}
        </Fact>
        <Fact label="Check-in area">{formatDistance(task.radiusM)}</Fact>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Crew</Label>
        <div className="flex flex-wrap gap-1.5">
          {task.assignees.length === 0 ? (
            <span className="text-n-400 text-[13px]">Unassigned</span>
          ) : (
            task.assignees.map((member) => {
              const here = task.onSite.some((entry) => entry.id === member.id)
              return (
                <span
                  key={member.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12.5px]",
                    here
                      ? "border-p-400 bg-p-50 text-p-700"
                      : "border-n-200 text-n-700 bg-white"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "font-heading flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold",
                      here ? "bg-p-500 text-white" : "bg-n-100 text-n-600"
                    )}
                  >
                    {initialsOf(member.name)}
                  </span>
                  {member.name}
                  {here ? " · on site" : ""}
                </span>
              )
            })
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Where</Label>
        <MapPicker
          readOnly
          value={{ lat: task.lat, lng: task.lng }}
          radiusM={task.radiusM}
          onChange={() => {}}
        />
      </div>
    </div>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="border-n-200 flex flex-col gap-0.5 rounded-md border bg-white px-3 py-2">
      <Label>{label}</Label>
      <span className="text-[13.5px]">{children}</span>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em] uppercase">
      {children}
    </span>
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
    day: "numeric",
    month: "short",
  }).format(new Date(iso))
}

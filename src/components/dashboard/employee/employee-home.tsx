"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "cn"

import { BellIcon } from "@/components/dashboard/nav-icons"
import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { EmployeeTaskCard } from "@/components/dashboard/employee/task-card"
import { CardsSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMinutes } from "@/lib/time"
import {
  reportMutationError,
  useAttendance,
  useShiftAction,
  useTasks,
  type TaskScope,
} from "@/lib/queries"

const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
]

export function EmployeeHome({ name, shift }: { name: string; shift: string | null }) {
  const [scope, setScope] = React.useState<TaskScope>("today")

  const attendance = useAttendance()
  const tasks = useTasks(scope)
  const shiftAction = useShiftAction()

  const timeZone = attendance.data?.timeZone ?? "UTC"
  const today = attendance.data?.days.find(
    (day) => day.day === attendance.data?.today
  )

  const list = tasks.data?.tasks ?? []
  const checkedIn = list.filter((task) => task.checkedInAt).length

  function press(action: "start" | "end") {
    if (shiftAction.isPending) return
    shiftAction.mutate(action, {
      onSuccess: () =>
        toast.success(action === "start" ? "Shift started" : "Shift ended"),
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <EmployeeScreen
      eyebrow={shortDate()}
      title="Today's tasks"
      aside={
        <Link
          href="/dashboard/requests"
          aria-label="Requests"
          className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[34px] items-center justify-center rounded-full border transition-colors"
        >
          <BellIcon className="size-4" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">
        <Tile label="SHIFT" value={shift ?? "Not set"} />

        {attendance.isPending ? (
          <TileSkeleton />
        ) : (
          <Tile
            label="ATTENDANCE"
            tone={today?.inAt ? "good" : "muted"}
            value={
              today?.inAt
                ? `In at ${clock(today.inAt, timeZone)}`
                : "Not checked in"
            }
            note={
              today?.status === "late"
                ? `${formatMinutes(today.lateByMin)} late`
                : today?.outAt
                  ? `Out at ${clock(today.outAt, timeZone)}`
                  : undefined
            }
          />
        )}

        <Tile
          label="ASSIGNED TODAY"
          value={tasks.isPending ? "…" : String(list.length)}
        />
        <Tile
          label="CHECKED IN"
          value={tasks.isPending ? "…" : String(checkedIn)}
          tone={checkedIn > 0 ? "good" : "muted"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => press("start")}
          disabled={shiftAction.isPending || Boolean(today?.inSource === "manual")}
          className="bg-p-500 rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-[1.06] disabled:opacity-50"
        >
          {shiftAction.isPending ? "Saving…" : "Start shift"}
        </button>
        <button
          type="button"
          onClick={() => press("end")}
          disabled={
            shiftAction.isPending ||
            !today?.inAt ||
            today?.outSource === "manual"
          }
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
        >
          End shift
        </button>
        <span className="text-n-400 self-center text-[12px]">
          Checking in to a task also opens your day.
        </span>
      </div>

      <div className="flex gap-2">
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

      {tasks.isPending ? (
        <CardsSkeleton cards={2} />
      ) : tasks.isError ? (
        <ErrorPanel onRetry={() => void tasks.refetch()} />
      ) : list.length === 0 ? (
        <PhoneEmpty
          message={
            scope === "today"
              ? `Nothing assigned to you today, ${firstName(name)}. Anything your owner assigns will appear here with its site and check-in area.`
              : scope === "upcoming"
                ? "Nothing scheduled ahead of today."
                : "No finished tasks yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {list.map((task) => (
            <EmployeeTaskCard key={task.id} task={task} timeZone={timeZone} />
          ))}
        </div>
      )}
    </EmployeeScreen>
  )
}

function Tile({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string
  value: string
  note?: string
  tone?: "plain" | "good" | "muted"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[3px] rounded-[10px] border px-3 py-2.5 lg:gap-1.5 lg:rounded-xl lg:p-4",
        tone === "good" ? "border-p-400 bg-p-50" : "border-n-200 bg-white"
      )}
    >
      <span
        className={cn(
          "font-mono text-[10px] tracking-[0.06em] lg:text-[10.5px]",
          tone === "good" ? "text-p-600" : "text-n-500"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold lg:text-[20px]",
          tone === "good" && "text-p-700",
          tone === "muted" && "text-n-400"
        )}
      >
        {value}
      </span>
      {note ? (
        <span className="text-n-500 text-[11.5px]">{note}</span>
      ) : null}
    </div>
  )
}

function TileSkeleton() {
  return (
    <div className="border-n-200 flex flex-col gap-2 rounded-[10px] border bg-white px-3 py-2.5 lg:rounded-xl lg:p-4">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-5 w-28" />
    </div>
  )
}

export function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="border-s-overdue flex flex-col items-start gap-3 rounded-[14px] border bg-white px-4 py-6">
      <p className="text-s-overdue m-0 text-[13.5px]">
        Couldn&rsquo;t load that. Your connection may have dropped.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2 text-[13px] font-semibold"
      >
        Try again
      </button>
    </div>
  )
}

function shortDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date())
    .toUpperCase()
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there"
}

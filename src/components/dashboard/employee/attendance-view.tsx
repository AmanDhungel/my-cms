"use client"

import * as React from "react"
import { cn } from "cn"

import { ErrorPanel } from "@/components/dashboard/employee/employee-home"
import {
  EmployeeScreen,
  PhoneEmpty,
  PhoneStat,
} from "@/components/dashboard/employee/screen"
import { CalendarSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { useAttendance } from "@/lib/queries"
import { formatMinutes } from "@/lib/time"
import type { AttendanceDTO } from "@/models/attendance"
import type { AttendanceStatus } from "@/lib/work-constants"

const DAY_LOOK: Record<AttendanceStatus, string> = {
  present: "bg-p-100 text-p-700 border-p-200",
  late: "bg-a-50 text-a-700 border-a-200",
  leave: "bg-[#efe9fd] text-[#5b3fb5] border-[#ded3fa]",
  absent: "bg-[#fdecec] text-s-overdue border-[#f7d4d5]",
}

export function AttendanceView() {
  const [month, setMonth] = React.useState<string | undefined>(undefined)
  const query = useAttendance(month)

  const data = query.data
  const activeMonth = data?.month ?? month ?? ""
  const byDay = new Map((data?.days ?? []).map((day) => [day.day, day]))

  return (
    <EmployeeScreen
      eyebrow={activeMonth ? monthLabel(activeMonth) : "Attendance"}
      title="Attendance"
      aside={
        activeMonth ? (
          <div className="flex items-center gap-1">
            <StepButton
              label="Previous month"
              onClick={() => setMonth(shiftMonth(activeMonth, -1))}
              glyph="‹"
            />
            <StepButton
              label="Next month"
              onClick={() => setMonth(shiftMonth(activeMonth, 1))}
              glyph="›"
            />
          </div>
        ) : null
      }
    >
      {query.isPending ? (
        <>
          <div className="grid grid-cols-4 gap-2 lg:gap-3.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="border-n-200 flex flex-col gap-2 rounded-[10px] border bg-white px-3 py-2.5 lg:rounded-xl lg:p-4"
              >
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
          <CalendarSkeleton />
        </>
      ) : query.isError ? (
        <ErrorPanel onRetry={() => void query.refetch()} />
      ) : data ? (
        <>
          <div className="grid grid-cols-4 gap-2 lg:gap-3.5">
            <PhoneStat label="PRESENT" value={data.summary.present} />
            <PhoneStat label="LATE" value={data.summary.late} />
            <PhoneStat label="LEAVE" value={data.summary.leave} />
            <PhoneStat label="ABSENT" value={data.summary.absent} />
          </div>

          <div className="border-n-200 rounded-[14px] border bg-white p-3.5 lg:p-5">
            <div className="text-n-400 mb-2 grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] tracking-[0.06em]">
              {["M", "T", "W", "T", "F", "S", "S"].map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {leadingBlanks(activeMonth).map((_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {daysOfMonth(activeMonth).map((dayKey) => {
                const record = byDay.get(dayKey)
                const isToday = dayKey === data.today

                return (
                  <span
                    key={dayKey}
                    title={record ? describe(record, data.timeZone) : undefined}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md border text-[12.5px] font-medium",
                      record
                        ? DAY_LOOK[record.status]
                        : "border-n-200 text-n-400 bg-white",
                      isToday && "ring-p-400 ring-2"
                    )}
                  >
                    {Number(dayKey.slice(8))}
                  </span>
                )
              })}
            </div>

            <div className="text-n-500 mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11.5px]">
              {(
                ["present", "late", "leave", "absent"] as AttendanceStatus[]
              ).map((status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-[3px] border",
                      DAY_LOOK[status]
                    )}
                  />
                  <span className="capitalize">{status}</span>
                </span>
              ))}
            </div>
          </div>

          {data.days.length === 0 ? (
            <PhoneEmpty message="No days recorded this month. A day opens when you start your shift or check in to a task." />
          ) : (
            <div className="border-n-200 overflow-hidden rounded-[14px] border bg-white">
              {data.days
                .slice()
                .reverse()
                .map((day) => (
                  <div
                    key={day.id}
                    className="border-n-200/70 flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold">
                        {dayLabel(day.day)}
                      </span>
                      <span className="text-n-500 text-[12px]">
                        {describe(day, data.timeZone)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize",
                        DAY_LOOK[day.status]
                      )}
                    >
                      {day.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : null}
    </EmployeeScreen>
  )
}

function StepButton({
  label,
  glyph,
  onClick,
}: {
  label: string
  glyph: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[30px] items-center justify-center rounded-md border text-[16px] leading-none"
    >
      {glyph}
    </button>
  )
}

function describe(day: AttendanceDTO, timeZone: string) {
  if (day.status === "leave" && !day.inAt) return "Approved leave"
  if (!day.inAt) return "No check-in"

  const parts = [`In ${clock(day.inAt, timeZone)}`]
  if (day.outAt) parts.push(`out ${clock(day.outAt, timeZone)}`)
  if (day.lateByMin > 0) parts.push(`${formatMinutes(day.lateByMin)} late`)
  return parts.join(" · ")
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, m - 1, 1)))
    .toUpperCase()
}

function dayLabel(dayKey: string) {
  const [year, m, d] = dayKey.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, d)))
}

function daysOfMonth(month: string) {
  if (!month) return []
  const [year, m] = month.split("-").map(Number)
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`
  )
}

/** Monday-first grid, so the first row lines up with the weekday header. */
function leadingBlanks(month: string) {
  if (!month) return []
  const [year, m] = month.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay()
  return Array.from({ length: (weekday + 6) % 7 })
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number)
  const moved = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`
}

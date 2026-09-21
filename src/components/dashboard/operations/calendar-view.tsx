"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { CalendarSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { KIND_COPY, KIND_ROUTES } from "@/lib/operations"
import { useCalendar, type CalendarItem } from "@/lib/queries"
import type { OperationKind } from "@/lib/work-constants"

/** Tasks ride along with the four kinds, so they need a colour of their own. */
const DOT: Record<string, string> = {
  meeting: KIND_COPY.meeting.dot,
  installation: KIND_COPY.installation.dot,
  follow_up: KIND_COPY.follow_up.dot,
  deadline: KIND_COPY.deadline.dot,
  task: "bg-n-400",
}

const LEGEND: { kind: string; label: string }[] = [
  { kind: "meeting", label: "Meetings" },
  { kind: "installation", label: "Installations" },
  { kind: "follow_up", label: "Follow-ups" },
  { kind: "deadline", label: "Deadlines" },
  { kind: "task", label: "Tasks" },
]

/**
 * The month, with everything dated on it. Read-only on purpose: a day opens
 * the list beside it, and the editing lives on the kind's own page where the
 * filters and the delete button already are.
 */
export function CalendarView() {
  const [month, setMonth] = React.useState<string | undefined>(undefined)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [hidden, setHidden] = React.useState<string[]>([])

  const query = useCalendar(month)

  const items = React.useMemo(() => query.data?.items ?? [], [query.data?.items])
  const shown = React.useMemo(
    () => items.filter((one) => !hidden.includes(one.kind)),
    [items, hidden]
  )

  const activeMonth = query.data?.month ?? month ?? ""
  const today = query.data?.today ?? ""

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of shown) {
      const bucket = map.get(item.day) ?? []
      bucket.push(item)
      map.set(item.day, bucket)
    }
    return map
  }, [shown])

  // The day panel follows the month: a date from September is not in October.
  const selected = picked && picked.startsWith(activeMonth) ? picked : null
  const dayItems = selected ? (byDay.get(selected) ?? []) : []

  function step(delta: number) {
    setMonth(shiftMonth(activeMonth || today.slice(0, 7), delta))
    setPicked(null)
  }

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Operations"
        title="Calendar"
        subtitle="Meetings, installations, follow-ups, deadlines and the tasks already booked — one month at a time."
        actions={
          activeMonth ? (
            <div className="flex items-center gap-1.5">
              <Step label="Previous month" glyph="‹" onClick={() => step(-1)} />
              <span className="border-n-200 text-n-700 min-w-[150px] rounded-md border bg-white px-3 py-2 text-center font-mono text-[12.5px]">
                {monthLabel(activeMonth)}
              </span>
              <Step label="Next month" glyph="›" onClick={() => step(1)} />
            </div>
          ) : null
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <StatCard label="ON THE MONTH" value={query.data?.summary.total ?? 0} />
          <StatCard label="OPERATIONS" value={query.data?.summary.operations ?? 0} />
          <StatCard label="TASKS" value={query.data?.summary.tasks ?? 0} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGEND.map((one) => {
          const off = hidden.includes(one.kind)
          return (
            <button
              key={one.kind}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) =>
                  prev.includes(one.kind)
                    ? prev.filter((k) => k !== one.kind)
                    : [...prev, one.kind]
                )
              }
              className={cn(
                "flex items-center gap-1.5 text-[12.5px] transition-opacity",
                off ? "text-n-400 opacity-60" : "text-n-600"
              )}
            >
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full", DOT[one.kind])}
              />
              {one.label}
            </button>
          )
        })}
      </div>

      {query.isError ? (
        <EmptyState
          message="Couldn't load the calendar. Your connection may have dropped."
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
      ) : query.isPending ? (
        <CalendarSkeleton />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel className="p-3.5 lg:p-5">
            <div className="text-n-400 mb-2 grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] tracking-[0.06em]">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {leadingBlanks(activeMonth).map((_, i) => (
                <span key={`blank-${i}`} />
              ))}

              {daysOfMonth(activeMonth).map((day) => {
                const entries = byDay.get(day) ?? []
                const isToday = day === today

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPicked(day === selected ? null : day)}
                    aria-pressed={day === selected}
                    className={cn(
                      "flex min-h-[74px] flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                      day === selected
                        ? "border-p-400 bg-p-50"
                        : "border-n-200 hover:bg-n-50 bg-white",
                      isToday && day !== selected && "ring-p-400 ring-2"
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-[11.5px]",
                        isToday ? "text-p-700 font-semibold" : "text-n-500"
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>

                    <span className="flex w-full flex-col gap-0.5">
                      {entries.slice(0, 2).map((item) => (
                        <span
                          key={item.id}
                          className="flex items-center gap-1 text-[10.5px] leading-tight"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              DOT[item.kind]
                            )}
                          />
                          <span className="text-n-600 truncate">
                            {item.title}
                          </span>
                        </span>
                      ))}
                      {entries.length > 2 ? (
                        <span className="text-n-400 font-mono text-[10px]">
                          +{entries.length - 2} more
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading m-0 text-base font-semibold">
                {selected ? longDate(selected) : "Pick a day"}
              </h2>
              <span className="text-n-500 font-mono text-[11px]">
                {selected ? dayItems.length : shown.length}
              </span>
            </div>

            {!selected ? (
              <p className="text-n-500 m-0 text-[13px] leading-relaxed">
                Tap a day to see what is on it. Use the dots above to hide a
                kind you are not interested in.
              </p>
            ) : dayItems.length === 0 ? (
              <p className="text-n-500 m-0 text-[13px]">Nothing on this day.</p>
            ) : (
              dayItems.map((item) => <DayRow key={item.id} item={item} />)
            )}
          </Panel>
        </div>
      )}
    </DashboardMain>
  )
}

function DayRow({ item }: { item: CalendarItem }) {
  const href =
    item.source === "task"
      ? "/dashboard/tasks"
      : KIND_ROUTES[item.kind as OperationKind]

  return (
    <Link
      href={href}
      className="border-n-200 hover:bg-n-50 flex flex-col gap-1 rounded-[10px] border bg-white px-3 py-2.5 transition-colors"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", DOT[item.kind])}
        />
        <span className="text-[13.5px] font-semibold">{item.title}</span>
      </span>
      <span className="text-n-500 pl-4 text-[12px]">
        {item.allDay ? "All day" : clock(item.startAt)}
        {item.where ? ` · ${item.where}` : ""}
        {item.people.length ? ` · ${item.people.join(", ")}` : ""}
      </span>
    </Link>
  )
}

function Step({
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
      className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[34px] items-center justify-center rounded-md border text-[16px] leading-none"
    >
      {glyph}
    </button>
  )
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

/** Monday-first, so the grid lines up with the weekday header. */
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

function longDate(day: string) {
  const [year, m, d] = day.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, d)))
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

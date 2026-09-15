"use client"

import * as React from "react"
import { cn } from "cn"

import { DayStepper } from "@/components/dashboard/attendance/day-stepper"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { formatDistance } from "@/lib/geo"
import { describeStartPlace, PLACE_LABELS } from "@/lib/office"
import {
  useCrewAttendance,
  useVisits,
  type CrewAttendanceRow,
  type Visit,
} from "@/lib/queries"
import { formatMinutes } from "@/lib/time"
import type { AttendanceStatus } from "@/lib/work-constants"

const TABS = [
  { value: "days", label: "Everyday attendance" },
  { value: "tasks", label: "Task attendance" },
] as const
type Tab = (typeof TABS)[number]["value"]

const STATUS_LOOK: Record<AttendanceStatus, string> = {
  present: "border-p-200 bg-p-100 text-p-700",
  late: "border-a-200 bg-a-50 text-a-700",
  leave: "border-[#ded3fa] bg-[#efe9fd] text-[#5b3fb5]",
  absent: "border-[#f7d4d5] bg-[#fdecec] text-s-overdue",
}

/**
 * What the owner sees on /dashboard/attendance. Two questions, two tabs:
 * whether the crew turned up, and whether they were where the work was.
 */
export function CrewAttendanceView() {
  const [tab, setTab] = React.useState<Tab>("days")
  const [day, setDay] = React.useState<string | undefined>(undefined)

  const crew = useCrewAttendance(day)
  const visits = useVisits(day)

  const active = tab === "days" ? crew : visits
  const shownDay = active.data?.day ?? day ?? ""
  const today = active.data?.today ?? ""
  const timeZone = active.data?.timeZone ?? "UTC"

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Attendance"
        subtitle="Shifts opened and closed, and every arrival at a job — with the time and the place."
        actions={
          shownDay ? (
            <DayStepper
              day={shownDay}
              today={today}
              onChange={(next) => setDay(next)}
            />
          ) : null
        }
      />

      <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            aria-pressed={tab === option.value}
            className={cn(
              "rounded-[5px] px-3.5 py-2 text-[13px] transition-colors",
              tab === option.value
                ? "bg-p-100 text-p-700 font-semibold"
                : "text-n-600 hover:bg-n-100 font-medium"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "days" ? (
        <DaysTab query={crew} timeZone={timeZone} />
      ) : (
        <TasksTab query={visits} timeZone={timeZone} />
      )}
    </DashboardMain>
  )
}

function DaysTab({
  query,
  timeZone,
}: {
  query: ReturnType<typeof useCrewAttendance>
  timeZone: string
}) {
  const rows = query.data?.rows ?? []
  const summary = query.data?.summary

  if (query.isError) return <Failed onRetry={() => void query.refetch()} />

  return (
    <>
      {query.isPending || !summary ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="TURNED UP" value={`${summary.present}/${summary.crew}`} />
          <StatCard label="LATE" value={summary.late} accent={summary.late > 0} />
          <StatCard
            label="AWAY FROM OFFICE"
            value={summary.away}
            accent={summary.away > 0}
          />
          <StatCard label="STILL ON SHIFT" value={summary.stillIn} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState message="Nobody is on this workspace yet. Invite your crew from People." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.3fr_120px_120px_1.4fr_110px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["PERSON", "STARTED", "ENDED", "WHERE THEY OPENED THE DAY", "STATUS"].map(
              (head) => (
                <span
                  key={head}
                  className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                >
                  {head}
                </span>
              )
            )}
          </div>

          {rows.map((row) => (
            <CrewRow key={row.user.id} row={row} timeZone={timeZone} />
          ))}
        </Panel>
      )}
    </>
  )
}

function CrewRow({
  row,
  timeZone,
}: {
  row: CrewAttendanceRow
  timeZone: string
}) {
  const day = row.attendance
  const status: AttendanceStatus = day?.inAt ? day.status : "absent"

  return (
    <div className="border-n-200/70 hover:bg-n-50 grid gap-2 border-b px-[18px] py-3.5 last:border-b-0 lg:grid-cols-[1.3fr_120px_120px_1.4fr_110px] lg:items-center lg:gap-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-semibold">
          {row.user.name}
          {row.user.removed ? (
            <span className="text-n-400 ml-1.5 font-mono text-[10.5px]">
              REMOVED
            </span>
          ) : null}
        </span>
        <span className="text-n-500 text-[12px] capitalize">
          {row.user.role}
          {row.user.shift ? ` · ${row.user.shift}` : ""}
        </span>
      </div>

      <span className="text-n-700 font-mono text-[13px]">
        {day?.inAt ? clock(day.inAt, timeZone) : "—"}
        {day && day.lateByMin > 0 ? (
          <span className="text-a-700 block text-[11px]">
            {formatMinutes(day.lateByMin)} late
          </span>
        ) : null}
      </span>

      <span className="text-n-700 font-mono text-[13px]">
        {day?.outAt ? clock(day.outAt, timeZone) : day?.inAt ? "still in" : "—"}
        {day?.outSource === "auto" ? (
          <span className="text-n-400 block font-mono text-[10.5px]">
            AUTO-CLOSED
          </span>
        ) : null}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-n-600 text-[12.5px]">
          {day?.inAt ? (describeStartPlace(day) ?? "No location recorded") : "—"}
        </span>
        {day?.inNote ? (
          <span className="text-n-500 text-[12px] italic">
            &ldquo;{day.inNote}&rdquo;
          </span>
        ) : null}
        {day?.outPlace ? (
          <span className="text-n-400 text-[11.5px]">
            Closed: {PLACE_LABELS[day.outPlace].toLowerCase()}
            {day.outDistanceM === null
              ? ""
              : ` · ${formatDistance(day.outDistanceM)} away`}
          </span>
        ) : null}
      </div>

      <span
        className={cn(
          "w-fit rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize",
          STATUS_LOOK[status]
        )}
      >
        {status}
      </span>
    </div>
  )
}

function TasksTab({
  query,
  timeZone,
}: {
  query: ReturnType<typeof useVisits>
  timeZone: string
}) {
  const visits = query.data?.visits ?? []
  const summary = query.data?.summary

  if (query.isError) return <Failed onRetry={() => void query.refetch()} />

  return (
    <>
      {query.isPending || !summary ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="ARRIVALS" value={summary.arrivals} />
          <StatCard label="DEPARTURES" value={summary.departures} />
          <StatCard
            label="OUTSIDE THE FENCE"
            value={summary.outside}
            accent={summary.outside > 0}
          />
          <StatCard label="PEOPLE ON SITE" value={summary.people} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : visits.length === 0 ? (
        <EmptyState message="No task check-ins on this day. They appear the moment someone arrives at a job." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 bg-n-100 hidden grid-cols-[92px_1.1fr_1.4fr_1fr] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["TIME", "PERSON", "TASK / SITE", "DISTANCE"].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {visits.map((visit) => (
            <VisitRow key={visit.id} visit={visit} timeZone={timeZone} />
          ))}
        </Panel>
      )}
    </>
  )
}

function VisitRow({ visit, timeZone }: { visit: Visit; timeZone: string }) {
  const arrived = visit.type === "in"

  return (
    <div className="border-n-200/70 hover:bg-n-50 grid gap-2 border-b px-[18px] py-3.5 last:border-b-0 lg:grid-cols-[92px_1.1fr_1.4fr_1fr] lg:items-center lg:gap-3.5">
      <span className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-0.5">
        <span className="text-n-700 font-mono text-[13px]">
          {clock(visit.at, timeZone)}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] tracking-[0.06em]",
            arrived ? "text-p-600" : "text-n-500"
          )}
        >
          {arrived ? "IN" : "OUT"}
        </span>
      </span>

      <span className="text-[13.5px] font-semibold">{visit.user.name}</span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px]">{visit.task.title}</span>
        <span className="text-n-500 text-[12px]">{visit.task.site}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "font-mono text-[12.5px]",
            visit.insideFence ? "text-n-600" : "text-s-overdue"
          )}
        >
          {formatDistance(visit.distanceM)}
          {visit.insideFence ? " · inside" : " · outside"}
        </span>
        {visit.reason ? (
          <span className="text-n-500 text-[12px] italic">
            &ldquo;{visit.reason}&rdquo;
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      message="Couldn't load that. Your connection may have dropped."
      action={
        <button type="button" onClick={onRetry} className={primaryButtonClass}>
          Try again
        </button>
      }
    />
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

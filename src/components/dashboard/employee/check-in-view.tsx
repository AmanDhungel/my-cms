"use client"

import { cn } from "cn"

import { ErrorPanel } from "@/components/dashboard/employee/employee-home"
import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { EmployeeTaskCard } from "@/components/dashboard/employee/task-card"
import { CardsSkeleton } from "@/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocationFix } from "@/components/dashboard/employee/use-location"
import { distanceInMetres, formatDistance } from "@/lib/geo"
import { useAttendance, useTasks } from "@/lib/queries"

/**
 * A single screen for the one thing the crew does most. It reads a position
 * once on open so the cards can be ordered by how close they are.
 */
export function CheckInView() {
  const tasks = useTasks("today")
  const attendance = useAttendance()

  const { fix, error, locating, retry } = useLocationFix()

  const timeZone = attendance.data?.timeZone ?? "UTC"
  const open = (tasks.data?.tasks ?? []).filter(
    (task) => task.status !== "done" && task.status !== "cancelled"
  )

  const ordered = fix
    ? [...open].sort(
        (a, b) => distanceInMetres(fix, a) - distanceInMetres(fix, b)
      )
    : open

  const active = ordered.find((task) => task.checkedInAt)

  return (
    <EmployeeScreen eyebrow="Where you are" title="Check in">
      {locating ? (
        <div className="border-n-200 flex flex-col gap-2 rounded-[14px] border bg-white p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-6 w-52" />
          <span className="text-n-500 text-[12.5px]">Finding you…</span>
        </div>
      ) : error ? (
        <div className="border-a-400 bg-a-50 flex flex-col items-start gap-3 rounded-[14px] border p-4">
          <p className="text-a-900 m-0 text-[13.5px] leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="border-n-300 text-n-700 rounded-md border bg-white px-3 py-2 text-[13px] font-semibold"
          >
            Try again
          </button>
          <p className="text-a-700 m-0 text-[12.5px]">
            You can still check in from a card below — you&rsquo;ll be asked for
            a reason if your position can&rsquo;t be confirmed.
          </p>
        </div>
      ) : fix ? (
        <div className="border-p-400 bg-p-50 flex flex-col gap-1 rounded-[14px] border p-4">
          <span className="text-p-600 font-mono text-[10.5px] tracking-[0.06em]">
            YOUR POSITION
          </span>
          <span className="text-p-700 text-[17px] font-semibold">
            {active
              ? `Checked in at ${active.site}`
              : ordered[0]
                ? `${formatDistance(distanceInMetres(fix, ordered[0]))} from ${ordered[0].site}`
                : "No task nearby"}
          </span>
          <span className="text-n-500 text-[12.5px]">
            Accurate to about {formatDistance(fix.accuracyM)} ·{" "}
            <button
              type="button"
              onClick={retry}
              className="text-p-600 font-semibold underline underline-offset-2"
            >
              refresh
            </button>
          </span>
        </div>
      ) : null}

      {tasks.isPending ? (
        <CardsSkeleton cards={2} />
      ) : tasks.isError ? (
        <ErrorPanel onRetry={() => void tasks.refetch()} />
      ) : ordered.length === 0 ? (
        <PhoneEmpty message="Nothing open today. When your owner assigns a task it appears here, nearest first." />
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {ordered.map((task) => (
            <div key={task.id} className="flex flex-col gap-1.5">
              {fix ? (
                <span
                  className={cn(
                    "px-1 font-mono text-[10.5px] tracking-[0.06em]",
                    distanceInMetres(fix, task) <= task.radiusM
                      ? "text-p-600"
                      : "text-a-700"
                  )}
                >
                  {formatDistance(distanceInMetres(fix, task))} AWAY ·{" "}
                  {distanceInMetres(fix, task) <= task.radiusM
                    ? "INSIDE THE AREA"
                    : "OUTSIDE THE AREA"}
                </span>
              ) : null}
              <EmployeeTaskCard task={task} timeZone={timeZone} />
            </div>
          ))}
        </div>
      )}
    </EmployeeScreen>
  )
}

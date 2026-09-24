"use client"

import * as React from "react"
import { cn } from "cn"

import { CheckInDialog } from "@/components/dashboard/employee/check-in-dialog"
import { StatusDialog } from "@/components/dashboard/employee/status-dialog"
import { EyeIcon, PinIcon } from "@/components/dashboard/nav-icons"
import { TicketStatusBadge } from "@/components/dashboard/ticket-status-badge"
import { TicketDetailDialog } from "@/components/dashboard/tickets/ticket-detail-dialog"
import { formatDistance } from "@/lib/geo"
import { CHECK_IN_OPENS_MIN } from "@/lib/work-constants"
import type { TicketDTO } from "@/models/ticket"

/** One assignment on the crew app, with whatever action it's ready for. */
export function EmployeeTicketCard({
  ticket,
  timeZone,
}: {
  ticket: TicketDTO
  timeZone: string
}) {
  const [dialog, setDialog] = React.useState<
    "in" | "out" | "status" | "detail" | null
  >(null)

  const checkedIn = Boolean(ticket.myCheckedInAt)
  const closed = ticket.status === "done" || ticket.status === "cancelled"

  // The server refuses an early check-in; showing when it opens is kinder
  // than letting someone tap and be told no. The clock is read on a timer
  // rather than during render, and ticks so the button unlocks on its own.
  const [now, setNow] = React.useState<number | null>(null)

  React.useEffect(() => {
    const read = () => setNow(Date.now())
    const first = setTimeout(read, 0)
    const timer = setInterval(read, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  const opensAt = new Date(ticket.startAt).getTime() - CHECK_IN_OPENS_MIN * 60_000
  const tooEarly = !checkedIn && now !== null && now < opensAt

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[14px] border bg-white p-[15px]",
        checkedIn
          ? "border-s-progress shadow-[0_6px_18px_rgba(47,125,225,0.12)]"
          : "border-n-200"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
            {window_(ticket, timeZone)}
          </span>
          <span className="text-[16px] leading-snug font-semibold">
            {ticket.title}
          </span>
          <span className="text-n-500 flex items-center gap-1.5 text-[12.5px]">
            <PinIcon className="size-3 shrink-0" />
            {ticket.project?.name ? `${ticket.project.name} · ` : ""}
            {ticket.site} · fence {formatDistance(ticket.radiusM)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TicketStatusBadge status={ticket.status} />
          <button
            type="button"
            aria-label="View details"
            onClick={() => setDialog("detail")}
            className="border-n-300 text-n-700 hover:bg-n-100 flex items-center justify-center rounded-md border bg-white px-2 py-1.5"
          >
            <EyeIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {ticket.description ? (
        <p className="text-n-600 m-0 text-[13px] leading-relaxed">
          {ticket.description}
        </p>
      ) : null}

      {ticket.blockedReason ? (
        <p className="border-a-400 bg-a-50 text-a-900 m-0 rounded-md border-l-2 px-3 py-2 text-[12.5px] leading-relaxed">
          Blocked: {ticket.blockedReason}
        </p>
      ) : null}

      {checkedIn ? (
        <span className="text-p-600 flex items-center gap-1.5 text-[12px]">
          <span aria-hidden className="bg-s-done size-[7px] rounded-full" />
          Checked in at {clock(ticket.myCheckedInAt!, timeZone)}
        </span>
      ) : null}

      {/* Who else is on this job, so nobody turns up thinking they're alone. */}
      {ticket.assignees.length > 1 ? (
        <span className="text-n-500 text-[12px]">
          With {ticket.assignees.length - 1} other
          {ticket.assignees.length > 2 ? "s" : ""}
          {ticket.onSite.length > 0 ? ` · ${ticket.onSite.length} on site now` : ""}
        </span>
      ) : null}

      {closed ? null : (
        <div className="flex flex-wrap gap-2">
          {checkedIn ? (
            <button
              type="button"
              onClick={() => setDialog("out")}
              className="bg-n-700 flex-1 rounded-md px-3 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.1]"
            >
              Check out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDialog("in")}
              disabled={tooEarly}
              className="bg-p-500 flex-1 rounded-md px-3 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-45"
            >
              {tooEarly
                ? `Opens ${clock(new Date(opensAt).toISOString(), timeZone)}`
                : "Check in"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialog("status")}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2.5 text-[13.5px] font-semibold"
          >
            Update status
          </button>
        </div>
      )}

      <CheckInDialog
        ticket={ticket}
        mode={dialog === "out" ? "out" : "in"}
        open={dialog === "in" || dialog === "out"}
        onClose={() => setDialog(null)}
      />
      <StatusDialog
        ticket={ticket}
        open={dialog === "status"}
        onClose={() => setDialog(null)}
      />
      <TicketDetailDialog
        ticket={ticket}
        timeZone={timeZone}
        open={dialog === "detail"}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function window_(ticket: TicketDTO, timeZone: string) {
  return `${clock(ticket.startAt, timeZone)}–${clock(ticket.endAt, timeZone)}`
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

"use client"

import * as React from "react"

import { ErrorPanel } from "@/components/dashboard/employee/employee-home"
import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { EmployeeTicketCard } from "@/components/dashboard/employee/ticket-card"
import { CardsSkeleton } from "@/components/dashboard/skeletons"
import { useAttendance, useTickets } from "@/lib/queries"
import { groupMyTickets } from "@/lib/ticket-window"

/**
 * Everything assigned to me, in three groups: now, upcoming and past.
 *
 * The grouping is the same helper the API uses to lock past tickets, so a
 * ticket shown under Past is exactly one the server will refuse a check-in
 * or status change on.
 */
export function MyTicketsView() {
  const tickets = useTickets("mine")
  const attendance = useAttendance()
  const timeZone = attendance.data?.timeZone ?? "UTC"

  // Read on a timer rather than during render, and ticking, so a ticket
  // moves from Now to Past on its own at midnight.
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    const read = () => setNow(Date.now())
    const first = setTimeout(read, 0)
    const timer = setInterval(read, 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  const groups = React.useMemo(
    () =>
      now === null
        ? null
        : groupMyTickets(tickets.data?.tickets ?? [], new Date(now), timeZone),
    [now, tickets.data, timeZone]
  )

  return (
    <EmployeeScreen eyebrow="Assigned to you" title="My tickets">
      {tickets.isPending || attendance.isPending || !groups ? (
        <CardsSkeleton cards={3} />
      ) : tickets.isError ? (
        <ErrorPanel onRetry={() => void tickets.refetch()} />
      ) : (
        <>
          <Group
            id="now"
            label="Now"
            empty="Nothing to work on right now."
            tickets={groups.current}
            timeZone={timeZone}
          />
          <Group
            id="upcoming"
            label="Upcoming"
            empty="Nothing scheduled ahead."
            tickets={groups.upcoming}
            timeZone={timeZone}
          />
          <Group
            id="past"
            label="Past"
            empty="No finished tickets yet."
            tickets={groups.past}
            timeZone={timeZone}
          />
        </>
      )}
    </EmployeeScreen>
  )
}

function Group({
  id,
  label,
  empty,
  tickets,
  timeZone,
}: {
  id: string
  label: string
  empty: string
  tickets: Parameters<typeof EmployeeTicketCard>[0]["ticket"][]
  timeZone: string
}) {
  return (
    <section data-ticket-group={id} className="flex flex-col gap-2.5">
      <h2 className="text-n-500 m-0 font-mono text-[11px] font-medium tracking-[0.07em] uppercase">
        {label} · {tickets.length}
      </h2>
      {tickets.length === 0 ? (
        <PhoneEmpty message={empty} />
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {tickets.map((ticket) => (
            <EmployeeTicketCard key={ticket.id} ticket={ticket} timeZone={timeZone} />
          ))}
        </div>
      )}
    </section>
  )
}

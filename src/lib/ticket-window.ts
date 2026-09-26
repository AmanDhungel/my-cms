import { dayKeyInZone } from "@/lib/time"
import type { TicketStatus } from "@/lib/work-constants"

/**
 * Where a ticket sits in time for the crew: now, upcoming, or past.
 *
 * Client-safe, and the one definition both the crew app and the API use —
 * the app hides the buttons on a past ticket, and the API refuses the same
 * actions, so the two can never disagree about which tickets are past.
 */

/**
 * Statuses that finish a ticket for the crew. "in_review" is the crew's
 * "complete"; "done" is the owner's sign-off. A ticket sent back down the
 * board stops being past again.
 */
export const FINISHED_STATUSES: readonly TicketStatus[] = [
  "in_review",
  "done",
  "cancelled",
]

type Timed = { status: TicketStatus | string; startAt: Date | string; endAt: Date | string }

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value)

/**
 * Past: finished (see FINISHED_STATUSES), or its last day is over.
 *
 * "Over" is read in the business time zone and by calendar day, not by the
 * instant: a job that was due to end at 10:00 today can still be worked on
 * this afternoon, and becomes past at midnight in the workspace's zone.
 */
export function isPastTicket(ticket: Timed, now: Date, timeZone: string) {
  if (FINISHED_STATUSES.includes(ticket.status as TicketStatus)) return true
  return dayKeyInZone(toDate(ticket.endAt), timeZone) < dayKeyInZone(now, timeZone)
}

/** Not past, and its window has started (or it is already being worked). */
export function isCurrentTicket(ticket: Timed, now: Date, timeZone: string) {
  if (isPastTicket(ticket, now, timeZone)) return false
  if (ticket.status === "in_progress" || ticket.status === "blocked") return true
  return dayKeyInZone(toDate(ticket.startAt), timeZone) <= dayKeyInZone(now, timeZone)
}

/**
 * The crew's own list, in three groups.
 *
 * Now: nearest end first, as the day's list always read. Upcoming: soonest
 * start first. Past: most recently ended first.
 */
export function groupMyTickets<T extends Timed>(
  tickets: readonly T[],
  now: Date,
  timeZone: string
) {
  const time = (value: Date | string) => toDate(value).getTime()
  const current: T[] = []
  const upcoming: T[] = []
  const past: T[] = []
  for (const ticket of tickets) {
    if (isPastTicket(ticket, now, timeZone)) past.push(ticket)
    else if (isCurrentTicket(ticket, now, timeZone)) current.push(ticket)
    else upcoming.push(ticket)
  }
  current.sort((a, b) => time(a.startAt) - time(b.startAt))
  upcoming.sort((a, b) => time(a.startAt) - time(b.startAt))
  past.sort((a, b) => time(b.endAt) - time(a.endAt))
  return { current, upcoming, past }
}

/** What an employee is told when they try to act on a past ticket. */
export const PAST_TICKET_MESSAGE =
  "This ticket is finished, so it's view-only now. Ask your owner if it needs reopening."

/**
 * The query for tickets whose window touches [start, end): begun before the
 * range ends and not over before it starts. A multi-day job counts on every
 * day it spans, not only the day it began.
 */
export function windowOverlaps(start: Date, end: Date) {
  return { startAt: { $lt: end }, endAt: { $gte: start } }
}

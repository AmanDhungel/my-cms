import { dayKeyInZone, minutesIntoDay, parseShift } from "@/lib/time"
import { restsOn, shiftOn } from "@/lib/week-server"

/**
 * Overtime: checking in to a ticket outside somebody's shift.
 *
 * `classifyOvertime` is the only place that decides it. The API calls it with
 * its own clock and the shift it resolved itself — a client never says
 * whether something was overtime.
 */

/** The hours expected today, as minutes past local midnight. */
export type ShiftToday =
  | { kind: "work"; startMin: number; endMin: number }
  /** A rest day in their week: any work at all is outside the shift. */
  | { kind: "off" }
  /** No hours set anywhere, so nothing can be outside them. */
  | null

export type Overtime = {
  overtime: boolean
  /**
   * How far outside the shift `now` is, in minutes: before the start, or past
   * the end. 0 on a rest day, which has no shift to measure from, and 0 when
   * inside the shift.
   */
  minutes: number
  when: "before" | "after" | "off" | null
}

export function classifyOvertime(
  now: Date,
  shift: ShiftToday,
  timeZone: string
): Overtime {
  if (shift === null) return { overtime: false, minutes: 0, when: null }
  if (shift.kind === "off") return { overtime: true, minutes: 0, when: "off" }

  const at = minutesIntoDay(now, timeZone)
  const { startMin, endMin } = shift

  if (startMin < endMin) {
    if (at < startMin) return { overtime: true, minutes: startMin - at, when: "before" }
    if (at > endMin) return { overtime: true, minutes: at - endMin, when: "after" }
    return { overtime: false, minutes: 0, when: null }
  }

  // A shift that runs past midnight (22:00–06:00): inside is either side of it.
  if (at >= startMin || at <= endMin) return { overtime: false, minutes: 0, when: null }
  const after = at - endMin
  const before = startMin - at
  return after <= before
    ? { overtime: true, minutes: after, when: "after" }
    : { overtime: true, minutes: before, when: "before" }
}

/**
 * The shift that applies to someone at an instant: their own week, else the
 * workspace's, else their standing shift — the same resolution attendance
 * uses (week-server.ts).
 */
export function shiftToday(
  at: Date,
  member: { week?: unknown; shift?: string | null } | null | undefined,
  business: { week?: unknown } | null | undefined,
  timeZone: string
): ShiftToday {
  const day = dayKeyInZone(at, timeZone)
  if (restsOn(day, member, business)) return { kind: "off" }
  const parsed = parseShift(shiftOn(day, member, business))
  return parsed ? { kind: "work", ...parsed } : null
}

/** How the crew is asked, and what the API says when the reason is missing. */
export const OVERTIME_REASON_MESSAGE =
  "You're outside your shift. Say why you're working now."

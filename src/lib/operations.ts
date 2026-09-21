import type {
  OperationKind,
  OperationStatus,
  ScheduleKind,
} from "@/lib/work-constants"

/**
 * How each kind reads on screen. Kept free of any model import so the client
 * bundle never pulls mongoose in — the same rule the enums and the activity
 * labels already follow.
 */
export const KIND_COPY: Record<
  OperationKind,
  {
    /** The page's own title. */
    plural: string
    singular: string
    eyebrow: string
    subtitle: string
    empty: string
    /** Whether the dialog opens with a time or just a date. */
    allDayByDefault: boolean
    /** The three states, in this kind's own words. */
    states: Record<OperationStatus, string>
    /** What the "tick it off" button says. */
    complete: string
    reopen: string
    dot: string
  }
> = {
  meeting: {
    plural: "Meetings",
    singular: "Meeting",
    eyebrow: "Operations",
    subtitle: "Who you are sitting down with, when, and what came of it.",
    empty:
      "No meetings on the books. Add one and it shows up here and on the calendar.",
    allDayByDefault: false,
    states: { scheduled: "Scheduled", done: "Held", cancelled: "Cancelled" },
    complete: "Mark held",
    reopen: "Put back",
    dot: "bg-s-progress",
  },
  installation: {
    plural: "Installation dates",
    singular: "Installation",
    eyebrow: "Operations",
    subtitle: "What is going in where, on which day, and for whom.",
    empty:
      "Nothing booked in. Add an installation date and the crew can plan around it.",
    allDayByDefault: true,
    states: {
      scheduled: "Booked",
      done: "Installed",
      cancelled: "Cancelled",
    },
    complete: "Mark installed",
    reopen: "Put back",
    dot: "bg-p-500",
  },
  follow_up: {
    plural: "Follow-ups",
    singular: "Follow-up",
    eyebrow: "Operations",
    subtitle: "The calls and visits that are easy to let slide.",
    empty: "Nothing to chase. Add a follow-up so it doesn't get forgotten.",
    allDayByDefault: true,
    states: { scheduled: "Due", done: "Done", cancelled: "Dropped" },
    complete: "Mark done",
    reopen: "Reopen",
    dot: "bg-a-400",
  },
  deadline: {
    plural: "Important deadlines",
    singular: "Deadline",
    eyebrow: "Operations",
    subtitle: "The dates that cost you something if they pass.",
    empty: "No deadlines recorded. Add the ones that would hurt to miss.",
    allDayByDefault: true,
    states: { scheduled: "Open", done: "Met", cancelled: "Dropped" },
    complete: "Mark met",
    reopen: "Reopen",
    dot: "bg-s-overdue",
  },
}

/** The nav and route for each kind, so the two can't drift apart. */
export const KIND_ROUTES: Record<OperationKind, string> = {
  meeting: "/dashboard/meetings",
  installation: "/dashboard/installations",
  follow_up: "/dashboard/follow-ups",
  deadline: "/dashboard/deadlines",
}

export const SCHEDULE_COPY: Record<
  ScheduleKind,
  { label: string; look: string; hours: boolean }
> = {
  work: {
    label: "Working",
    look: "border-p-200 bg-p-100 text-p-700",
    hours: true,
  },
  overtime: {
    label: "Overtime",
    look: "border-a-200 bg-a-50 text-a-700",
    hours: true,
  },
  training: {
    label: "Training",
    look: "border-[#cfe3f7] bg-[#eaf3fc] text-[#2f5d8a]",
    hours: true,
  },
  off: {
    label: "Off",
    look: "border-n-300 bg-n-100 text-n-600",
    hours: false,
  },
  leave: {
    label: "Leave",
    look: "border-[#ded3fa] bg-[#efe9fd] text-[#5b3fb5]",
    hours: false,
  },
}

/**
 * Whether something dated has slipped past without being closed. A cancelled
 * or finished one never counts, however old it is.
 */
export function isOverdue(entry: {
  startAt: string
  endAt: string | null
  status: OperationStatus
}) {
  if (entry.status !== "scheduled") return false
  return new Date(entry.endAt ?? entry.startAt).getTime() < Date.now()
}

/** Days until something is due — negative once it has passed. */
export function daysUntil(iso: string) {
  const then = new Date(iso)
  const now = new Date()
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86_400_000)
}

/** "in 3 days" / "today" / "4 days ago" — how a due date reads in a list. */
export function dueLabel(iso: string) {
  const days = daysUntil(iso)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`
}

/** The Monday on or before a day. Rosters are read a week at a time. */
export function weekStart(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  const at = new Date(Date.UTC(year, month - 1, date))
  const back = (at.getUTCDay() + 6) % 7
  at.setUTCDate(at.getUTCDate() - back)
  return at.toISOString().slice(0, 10)
}

/** The seven day keys starting at `start`. */
export function weekFrom(start: string) {
  const [year, month, date] = start.split("-").map(Number)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(year, month - 1, date + i)).toISOString().slice(0, 10)
  )
}

/** Day keys are plain calendar dates, so UTC arithmetic can't drift them. */
export function shiftDays(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date + delta))
    .toISOString()
    .slice(0, 10)
}

/**
 * The four counts above a list. It lives here rather than in the view because
 * it asks what time it is, and a component that does that during render gives
 * a different answer every time React happens to re-run it.
 */
export function summariseOperations(
  entries: { startAt: string; endAt: string | null; status: OperationStatus }[]
) {
  const soon = Date.now() + 7 * 86_400_000

  return {
    open: entries.filter((one) => one.status === "scheduled").length,
    overdue: entries.filter(isOverdue).length,
    done: entries.filter((one) => one.status === "done").length,
    soon: entries.filter(
      (one) =>
        one.status === "scheduled" &&
        !isOverdue(one) &&
        new Date(one.startAt).getTime() < soon
    ).length,
  }
}

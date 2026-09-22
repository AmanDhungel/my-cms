import type { PatternKind } from "@/lib/work-constants"

/**
 * A repeating week: what somebody is normally doing on each of the seven
 * days. Index 0 is Monday.
 *
 * This is the standing rule. A row on the Employee schedules grid overrides
 * it for one particular day, and attendance records what actually happened —
 * three separate things, in that order of authority.
 *
 * Client-safe on purpose: settings, the People dialog, the roster grid, the
 * attendance views and the API all resolve a week the same way, so none of
 * them can disagree about whether a given Saturday is a working day.
 */
export type DayPlan = {
  kind: PatternKind
  /**
   * "HH:MM". Absent or null on a rest day, which has no hours by definition.
   * Both spellings are accepted because a mongoose subdocument leaves the
   * field off while a form sends an explicit null, and the zod schema that
   * feeds react-hook-form cannot normalise them without splitting its input
   * and output types.
   */
  startTime?: string | null
  endTime?: string | null
}

export type WeekPattern = DayPlan[]

/** Monday-first index for a "YYYY-MM-DD" day key. */
export function weekdayIndex(dayKey: string) {
  const [year, month, date] = dayKey.split("-").map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, date)).getUTCDay()
  // getUTCDay is Sunday-first; this week is Monday-first.
  return (jsDay + 6) % 7
}

/** A seven-day week where every day works the same hours. */
export function evenWeek(startTime = "09:00", endTime = "17:00"): WeekPattern {
  return Array.from({ length: 7 }, () => ({
    kind: "work" as const,
    startTime,
    endTime,
  }))
}

/**
 * The week a workspace starts from: the standing shift on weekdays, Saturday
 * and Sunday off. It is only ever a suggestion in a form — nothing applies it
 * behind the owner's back.
 */
export function suggestedWeek(shift?: string | null): WeekPattern {
  const parsed = splitShiftString(shift)
  const start = parsed?.start ?? "09:00"
  const end = parsed?.end ?? "17:00"

  return Array.from({ length: 7 }, (_, index) =>
    index >= 5
      ? { kind: "off" as const, startTime: null, endTime: null }
      : { kind: "work" as const, startTime: start, endTime: end }
  )
}

/**
 * Whose week applies. A person's own week wins; otherwise the workspace's
 * standard one; otherwise nobody has set one and the caller falls back to
 * however it behaved before weeks existed.
 */
export function resolveWeek(
  personal: WeekPattern | null | undefined,
  workspace: WeekPattern | null | undefined
): WeekPattern | null {
  if (isWeek(personal)) return personal
  if (isWeek(workspace)) return workspace
  return null
}

export function isWeek(value: unknown): value is WeekPattern {
  return Array.isArray(value) && value.length === 7
}

/** What the week says about one particular day. */
export function planFor(week: WeekPattern | null, dayKey: string): DayPlan | null {
  if (!week) return null
  return week[weekdayIndex(dayKey)] ?? null
}

/** True when the week makes this day a rest day — the Saturday-off case. */
export function isRestDay(week: WeekPattern | null, dayKey: string) {
  return planFor(week, dayKey)?.kind === "off"
}

/**
 * The day's hours as the "HH:MM–HH:MM" string the rest of the app already
 * speaks. Null on a rest day, which is what keeps lateness from being counted
 * against somebody who was never expected in.
 */
export function shiftStringFor(week: WeekPattern | null, dayKey: string) {
  const plan = planFor(week, dayKey)
  if (!plan || plan.kind === "off" || !plan.startTime || !plan.endTime) {
    return null
  }
  return `${plan.startTime}–${plan.endTime}`
}

/** How many days of the week are worked. Shown beside a pattern in the UI. */
export function workingDays(week: WeekPattern | null) {
  return (week ?? []).filter((day) => day.kind === "work").length
}

/** "Mon–Fri · 09:00–17:00" / "5 days · varies" — a week in one line. */
export function describeWeek(week: WeekPattern | null) {
  if (!week) return "No standard week set"

  const working = week
    .map((day, index) => ({ day, index }))
    .filter((one) => one.day.kind === "work")

  if (working.length === 0) return "Every day off"

  const hours = new Set(
    working.map((one) => `${one.day.startTime}–${one.day.endTime}`)
  )
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  // A single run of days reads as a range; anything else is listed.
  const indexes = working.map((one) => one.index)
  const contiguous = indexes.every(
    (value, i) => i === 0 || value === indexes[i - 1] + 1
  )
  const label =
    contiguous && indexes.length > 1
      ? `${names[indexes[0]]}–${names[indexes[indexes.length - 1]]}`
      : indexes.map((i) => names[i]).join(", ")

  return hours.size === 1
    ? `${label} · ${[...hours][0]}`
    : `${label} · hours vary`
}

/** Splits "08:00–17:00" into its two ends. */
export function splitShiftString(shift?: string | null) {
  const match = shift?.match(/^\s*(\d{2}:\d{2})\s*[–—-]\s*(\d{2}:\d{2})\s*$/)
  return match ? { start: match[1], end: match[2] } : null
}

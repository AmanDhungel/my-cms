import { isWeek, resolveWeek, shiftStringFor, type WeekPattern } from "@/lib/week"

/**
 * Turning a mongoose subdocument array into the plain week the rest of the
 * app passes around. Hydrated docs carry methods and undefined-vs-null noise
 * that the client-safe helpers should never have to think about.
 */
export function weekOf(raw: unknown): WeekPattern | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null

  const week = raw.map((day) => {
    const one = day as { kind?: string; startTime?: string; endTime?: string }
    return {
      kind: one.kind === "off" ? ("off" as const) : ("work" as const),
      startTime: one.startTime ?? null,
      endTime: one.endTime ?? null,
    }
  })

  return isWeek(week) ? week : null
}

/**
 * The week that actually applies to somebody: their own if they have one,
 * otherwise the workspace's standard.
 */
export function weekFor(
  member: { week?: unknown } | null | undefined,
  business: { week?: unknown } | null | undefined
) {
  return resolveWeek(weekOf(member?.week), weekOf(business?.week))
}

/**
 * The hours somebody is expected on a given day, as the "HH:MM–HH:MM" string
 * attendance already speaks.
 *
 * Null means no hours are expected — either a rest day in their week, or no
 * week set anywhere, in which case the caller falls back to the standing
 * `shift` string as it did before weeks existed.
 */
export function shiftOn(
  dayKey: string,
  member: { week?: unknown; shift?: string | null } | null | undefined,
  business: { week?: unknown } | null | undefined
) {
  const week = weekFor(member, business)

  // No week anywhere: the old single shift is still the whole truth.
  if (!week) return member?.shift ?? null

  // A week exists, so it decides — including deciding this is a rest day.
  return shiftStringFor(week, dayKey)
}

/** Whether the week makes this a rest day for them. */
export function restsOn(
  dayKey: string,
  member: { week?: unknown } | null | undefined,
  business: { week?: unknown } | null | undefined
) {
  const week = weekFor(member, business)
  if (!week) return false
  return shiftStringFor(week, dayKey) === null
}

/**
 * What actually gets written. A rest day is stripped of hours whatever the
 * form sent, so an "off" Saturday can never carry 09:00–17:00 and later be
 * read back as a working day by something that only looks at the times.
 */
export function cleanWeek(
  week: { kind: string; startTime?: string | null; endTime?: string | null }[]
) {
  return week.map((day) =>
    day.kind === "off"
      ? { kind: "off" as const }
      : {
          kind: "work" as const,
          startTime: day.startTime || undefined,
          endTime: day.endTime || undefined,
        }
  )
}

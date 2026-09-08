/**
 * Attendance is keyed by calendar day and judged against a shift, so both have
 * to be computed in the workspace's zone rather than the server's.
 */

/** Zones offered in organization settings. */
export const TIME_ZONES = [
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const

export function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** "YYYY-MM-DD" for `date` as seen in `zone`. */
export function dayKeyInZone(date: Date, zone: string) {
  // "en-CA" formats as YYYY-MM-DD, which is exactly the key shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Minutes past local midnight for `date` in `zone`. */
export function minutesIntoDay(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  return hour * 60 + minute
}

/**
 * "08:00–17:00" (en dash, as the shift options are written) -> minute offsets.
 * A hyphen is accepted too, since hand-entered values drift.
 */
export function parseShift(shift?: string | null) {
  if (!shift) return null

  const match = shift.match(/^\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})\s*$/)
  if (!match) return null

  const startMin = Number(match[1]) * 60 + Number(match[2])
  const endMin = Number(match[3]) * 60 + Number(match[4])
  return { startMin, endMin }
}

/**
 * How many minutes past the shift start (beyond the grace period) an arrival
 * was. 0 when on time, when there's no shift, or when the shift is unparseable.
 */
export function lateByMinutes(
  arrivedAt: Date,
  shift: string | null | undefined,
  zone: string,
  graceMin: number
) {
  const parsed = parseShift(shift)
  if (!parsed) return 0

  const arrived = minutesIntoDay(arrivedAt, zone)
  const late = arrived - (parsed.startMin + graceMin)
  return late > 0 ? late : 0
}

/** "14:32" in the workspace's zone. */
export function clockInZone(date: Date, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

/** The zone's UTC offset, in ms, at a given instant. */
function offsetMsAt(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)

  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")

  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second")
  )

  // Round to the second: formatToParts drops sub-second precision.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Start and end instants of a "YYYY-MM-DD" key, as seen in `zone`.
 * Used to scope "today's tasks" queries to the workspace's calendar day.
 */
export function dayRangeInZone(dayKey: string, zone: string) {
  const [year, month, day] = dayKey.split("-").map(Number)
  const wallClock = Date.UTC(year, month - 1, day, 0, 0, 0, 0)

  // Solve instant = wallClock - offset(instant). One correction pass settles
  // it; a second covers the rare case of a DST change during that day.
  let start = new Date(wallClock - offsetMsAt(new Date(wallClock), zone))
  start = new Date(wallClock - offsetMsAt(start, zone))

  const nextDay = new Date(wallClock + 24 * 60 * 60 * 1000)
  let end = new Date(nextDay.getTime() - offsetMsAt(nextDay, zone))
  end = new Date(nextDay.getTime() - offsetMsAt(end, zone))

  return { start, end }
}

/** "8 min" / "1h 05m" — lateness reads badly as a raw minute count. */
export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, "0")}m`
}

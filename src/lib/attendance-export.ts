import { formatDistance } from "@/lib/geo"
import { AWAY_REASON_LABELS, PLACE_LABELS } from "@/lib/office"
import { formatMinutes } from "@/lib/time"
import type { AttendanceStatus } from "@/lib/work-constants"
import { isRestDay, type WeekPattern } from "@/lib/week"
import type { AttendanceDTO } from "@/models/attendance"

/**
 * One line of a month sheet. Every calendar day gets one, whether or not a
 * record exists — a sheet that silently skips the days nobody turned up is
 * the one thing it must not do.
 */
export type SheetRow = {
  day: string
  /** "01" — the date alone, for the printed sheet's first column. */
  date: string
  weekday: string
  status: AttendanceStatus | null
  /** Their week says this is a rest day, so nothing was expected. */
  resting: boolean
  inAt: string | null
  outAt: string | null
  lateBy: string
  place: string
  distance: string
  reason: string
  note: string
  closedAt: string
  /** A day that hasn't happened yet is blank, never "absent". */
  future: boolean
}

export type SheetTotals = {
  present: number
  late: number
  leave: number
  absent: number
  rest: number
  away: number
  /** Days with a recorded start, which is what "worked" means here. */
  worked: number
}

/** Every day key in a month, in order. */
export function monthDays(month: string) {
  const [year, m] = month.split("-").map(Number)
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`
  )
}

/**
 * Joins a month's records onto its calendar.
 *
 * A past day with no record reads as absent, which is how the rest of the app
 * already treats one — unless their repeating week makes it a rest day, in
 * which case nothing was expected and nothing is counted against them.
 *
 * Without a week set anywhere the old reading stands: every past day without
 * a record is an absence, weekends included.
 */
export function buildSheet(
  month: string,
  days: AttendanceDTO[],
  today: string,
  week: WeekPattern | null = null
): SheetRow[] {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))

  return monthDays(month).map((day) => {
    const record = byDay.get(day)
    const future = day > today
    // Somebody who was never due in cannot be absent.
    const resting = isRestDay(week, day)

    return {
      day,
      date: day.slice(8),
      weekday: weekdayOf(day),
      status: record?.inAt
        ? record.status
        : record?.status === "leave"
          ? "leave"
          : future || resting
            ? null
            : "absent",
      inAt: record?.inAt ?? null,
      outAt: record?.outAt ?? null,
      lateBy: record && record.lateByMin > 0 ? formatMinutes(record.lateByMin) : "",
      place: record?.inPlace ? PLACE_LABELS[record.inPlace] : "",
      distance:
        record?.inDistanceM === null || record?.inDistanceM === undefined
          ? ""
          : formatDistance(record.inDistanceM),
      reason: record?.inReason ? AWAY_REASON_LABELS[record.inReason] : "",
      note: record?.inNote ?? "",
      closedAt: record?.outPlace
        ? `${PLACE_LABELS[record.outPlace]}${
            record.outDistanceM === null
              ? ""
              : ` (${formatDistance(record.outDistanceM)})`
          }`
        : "",
      future,
      resting,
    }
  })
}

export function totalsOf(rows: SheetRow[]): SheetTotals {
  return {
    present: rows.filter((row) => row.status === "present").length,
    late: rows.filter((row) => row.status === "late").length,
    leave: rows.filter((row) => row.status === "leave").length,
    absent: rows.filter((row) => row.status === "absent").length,
    rest: rows.filter((row) => row.resting).length,
    away: rows.filter((row) => row.place === PLACE_LABELS.away).length,
    worked: rows.filter((row) => row.inAt).length,
  }
}

const HEADERS = [
  "Day",
  "Weekday",
  "Status",
  "Started",
  "Ended",
  "Late by",
  "Where the day opened",
  "Distance",
  "Reason",
  "Note",
  "Where it closed",
]

/**
 * The spreadsheet. A leading BOM so Excel reads it as UTF-8 rather than
 * mangling the names and the "·" separators.
 */
export function toCsv({
  rows,
  totals,
  person,
  businessName,
  month,
  timeZone,
}: {
  rows: SheetRow[]
  totals: SheetTotals
  person: { name: string; role: string; shift: string | null }
  businessName: string
  month: string
  timeZone: string
}) {
  const lines: string[][] = [
    [businessName],
    ["Attendance", monthLabel(month)],
    ["Person", person.name],
    ["Role", person.role],
    ["Shift", person.shift ?? "Not set"],
    ["Time zone", timeZone],
    [],
    HEADERS,
    ...rows.map((row) => [
      row.day,
      row.weekday,
      row.status ?? "",
      row.inAt ? clock(row.inAt, timeZone) : "",
      row.outAt ? clock(row.outAt, timeZone) : "",
      row.lateBy,
      row.place,
      row.distance,
      row.reason,
      row.note,
      row.closedAt,
    ]),
    [],
    ["Worked", String(totals.worked)],
    ["Present", String(totals.present)],
    ["Late", String(totals.late)],
    ["Leave", String(totals.leave)],
    ["Absent", String(totals.absent)],
    ["Rest days", String(totals.rest)],
    ["Opened away from the office", String(totals.away)],
  ]

  return `﻿${lines.map((cells) => cells.map(escape).join(",")).join("\r\n")}`
}

/** A file name that sorts by month and says who it is about. */
export function fileNameFor(person: { name: string }, month: string) {
  const slug = person.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `attendance-${slug || "crew"}-${month}`
}

/** "September 2026" */
export function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)))
}

/** The months a download can be asked for: this one and the 17 before it. */
export function recentMonths(upTo: string, count = 18) {
  const [year, m] = upTo.split("-").map(Number)
  return Array.from({ length: count }, (_, i) => {
    const moved = new Date(Date.UTC(year, m - 1 - i, 1))
    return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`
  })
}

export function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function weekdayOf(day: string) {
  const [year, m, date] = day.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, date)))
}

/**
 * A cell is quoted whenever it holds a comma, a quote or a newline — and a
 * quote inside one is doubled, which is the whole of CSV's escaping.
 */
function escape(cell: string) {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

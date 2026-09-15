import { distanceInMetres, formatDistance } from "@/lib/geo"
import type { AwayReason, ShiftPlace } from "@/lib/work-constants"

export type Office = {
  lat: number
  lng: number
  label?: string | null
  radiusM: number
  awayRadiusM: number
}

/** What the crew see written beside each reason. */
export const AWAY_REASON_LABELS: Record<AwayReason, string> = {
  wfh: "Working from home",
  site_visit: "On a site visit",
  client_meeting: "Meeting a client",
  field_work: "Field work",
  delivery: "Delivery or pickup",
  travel: "Travelling",
  training: "Training",
  other: "Something else",
}

export type ShiftPlacement = {
  place: ShiftPlace
  distanceM: number
  /** True beyond the outer ring, where a reason has to be given. */
  needsReason: boolean
}

/**
 * Which of the two rings a position falls in.
 *
 * Inside the first you are at the office. Inside the second you are near
 * enough that nobody should have to justify it — a city GPS fix drifts by
 * tens of metres, and the car park is not an absence. Beyond it, a reason.
 *
 * The same function runs on the phone, to decide whether to ask, and on the
 * server, to decide whether to accept — so the two can never disagree.
 */
export function placeAgainstOffice(
  office: Office,
  at: { lat: number; lng: number }
): ShiftPlacement {
  const distanceM = distanceInMetres(office, at)

  const place: ShiftPlace =
    distanceM <= office.radiusM
      ? "office"
      : distanceM <= office.awayRadiusM
        ? "near"
        : "away"

  return { place, distanceM, needsReason: place === "away" }
}

/** What one of the two inner rings is called when a day is read back. */
export const PLACE_LABELS: Record<ShiftPlace, string> = {
  office: "At the office",
  near: "Near the office",
  away: "Away from the office",
}

/**
 * How a recorded start reads back on an attendance row — "Working from home
 * · 4.2 km away". Empty when the workspace had no office at the time, which
 * is every day recorded before one was pinned.
 */
export function describeStartPlace(day: {
  inPlace?: ShiftPlace | null
  inDistanceM?: number | null
  inReason?: AwayReason | null
}) {
  if (!day.inPlace) return null

  const head = day.inReason
    ? AWAY_REASON_LABELS[day.inReason]
    : PLACE_LABELS[day.inPlace]

  return day.inDistanceM === null || day.inDistanceM === undefined
    ? head
    : `${head} · ${formatDistance(day.inDistanceM)} away`
}

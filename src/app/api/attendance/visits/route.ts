import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { CheckIn } from "@/models/check-in"

export const runtime = "nodejs"

type Named = { _id: unknown; name?: string; title?: string; site?: string }

/**
 * Ticket attendance for one day: every arrival at and departure from a job,
 * with who, where, and how far from the marker they were standing.
 *
 * This is the other half of the attendance page. The crew tab answers "was
 * she at work today"; this one answers "was she where the work was".
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const day = normaliseDay(request.nextUrl.searchParams.get("day"), today)

    const { start, end } = dayRangeInZone(day, business.timeZone)

    const entries = await CheckIn.find({
      business: business._id,
      at: { $gte: start, $lt: end },
    })
      .sort({ at: -1 })
      .limit(500)
      .populate<{ user: Named }>("user", "name")
      .populate<{ ticket: Named }>("ticket", "title site radiusM")

    const visits = entries.map((entry) => ({
      id: String(entry._id),
      type: entry.type,
      at: entry.at.toISOString(),
      user: {
        id: String(entry.user?._id ?? ""),
        name: entry.user?.name ?? "Someone",
      },
      ticket: {
        id: String(entry.ticket?._id ?? ""),
        title: entry.ticket?.title ?? "A ticket that was deleted",
        site: entry.ticket?.site ?? "",
      },
      lat: entry.lat,
      lng: entry.lng,
      accuracyM: entry.accuracyM ?? null,
      distanceM: entry.distanceM,
      insideFence: entry.insideFence,
      reason: entry.reason ?? null,
    }))

    return ok({
      day,
      today,
      timeZone: business.timeZone,
      visits,
      summary: {
        total: visits.length,
        arrivals: visits.filter((visit) => visit.type === "in").length,
        departures: visits.filter((visit) => visit.type === "out").length,
        outside: visits.filter((visit) => !visit.insideFence).length,
        people: new Set(visits.map((visit) => visit.user.id)).size,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function normaliseDay(value: string | null, today: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today
}

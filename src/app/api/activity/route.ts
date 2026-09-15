import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Activity, toActivityDTO } from "@/models/activity"

export const runtime = "nodejs"

/**
 * One day of the workspace's audit trail. The owner alone reads this — a
 * supervisor sees their notifications, but who-did-what across everyone is
 * the owner's view.
 *
 * The day is bounded in the workspace's own zone, not the server's, so "today"
 * means the same thing here as it does everywhere else in the app.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const day = normaliseDay(request.nextUrl.searchParams.get("day"), today)

    const { start, end } = dayRangeInZone(day, business.timeZone)

    const entries = await Activity.find({
      business: business._id,
      at: { $gte: start, $lt: end },
    })
      .sort({ at: -1 })
      .limit(500)

    const rows = entries.map(toActivityDTO)

    return ok({
      day,
      today,
      timeZone: business.timeZone,
      entries: rows,
      // Counted here rather than in the client, which only ever holds one page.
      summary: {
        total: rows.length,
        people: new Set(rows.map((row) => row.actorId)).size,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** "2026-09-15", falling back to the workspace's today. */
function normaliseDay(value: string | null, today: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today
}

import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Notification, toNotificationDTO } from "@/models/notification"

export const runtime = "nodejs"

/** The signed-in person's own feed. There is no way to read anyone else's. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const params = request.nextUrl.searchParams

    // The sidebar badge polls for a number, not a hundred rows.
    if (params.get("count") === "1") {
      return ok({
        unread: await Notification.countDocuments({
          user: viewer.id,
          readAt: { $exists: false },
        }),
      })
    }

    const unreadOnly = params.get("unread") === "1"
    const filter: Record<string, unknown> = { user: viewer.id }
    if (unreadOnly) filter.readAt = { $exists: false }

    const [entries, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(100),
      Notification.countDocuments({ user: viewer.id, readAt: { $exists: false } }),
    ])

    return ok({ notifications: entries.map(toNotificationDTO), unread })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Marks one notification read, or all of them when no id is given. */
export async function POST(request: Request) {
  try {
    const viewer = await requireUser()
    const body = (await request.json().catch(() => ({}))) as { id?: string }

    await connectToDatabase()

    const filter: Record<string, unknown> = {
      user: viewer.id,
      readAt: { $exists: false },
    }
    if (body.id) filter._id = body.id

    const result = await Notification.updateMany(filter, {
      $set: { readAt: new Date() },
    })

    const unread = await Notification.countDocuments({
      user: viewer.id,
      readAt: { $exists: false },
    })

    return ok({ marked: result.modifiedCount, unread })
  } catch (error) {
    return handleApiError(error)
  }
}

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { windowOverlaps } from "@/lib/ticket-window"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { WorkRequest, toRequestDTO } from "@/models/request"
import { Ticket, toTicketDTO } from "@/models/ticket"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * The owner / supervisor home, with exactly the queries the dashboard page
 * runs server-side (src/app/dashboard/page.tsx:50-81): today's tickets
 * (up to 6), people on site now, crew size, and the pending requests (up
 * to 4). Employees get their home from /api/me, /api/attendance and
 * /api/tickets instead, as the web's employee home does.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const { start, end } = dayRangeInZone(today, business.timeZone)

    const [crew, todayTickets, checkedIn, pendingRequests] = await Promise.all([
      User.countDocuments({ business: business._id }),
      Ticket.find({
        business: business._id,
        // Every ticket running today, not only those that began today.
        ...windowOverlaps(start, end),
        status: { $ne: "cancelled" },
      })
        .sort({ startAt: 1 })
        .limit(6)
        .populate("assignees", "name"),
      // People on site, not tickets with somebody on them.
      Ticket.aggregate<{ total: number }>([
        { $match: { business: business._id } },
        { $project: { n: { $size: { $ifNull: ["$openCheckIns", []] } } } },
        { $group: { _id: null, total: { $sum: "$n" } } },
      ]),
      WorkRequest.find({ business: business._id, status: "pending" })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate("user", "name"),
    ])

    return ok({
      today,
      timeZone: business.timeZone,
      crew,
      onSite: checkedIn[0]?.total ?? 0,
      tickets: todayTickets.map((ticket) => toTicketDTO(ticket, viewer.id)),
      pendingRequests: pendingRequests.map(toRequestDTO),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

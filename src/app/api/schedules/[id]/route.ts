import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { connectToDatabase } from "@/lib/mongodb"
import { Schedule } from "@/models/schedule"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Clears one cell of the roster. There is no PATCH: saving the same person
 * and day again is the edit, so the only other thing a cell can do is empty.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/schedules/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()

    const entry = await Schedule.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!entry) throw new HttpError(404, "There's nothing rostered there")

    const member = await User.findById(entry.user).select("name")

    await logActivity({
      businessId: viewer.businessId,
      action: "schedule_cleared",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: member?.name ?? "someone",
      detail: entry.day,
      targetKind: "schedule",
      targetId: entry._id,
      href: "/dashboard/schedules",
    })

    return ok({ id: String(entry._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

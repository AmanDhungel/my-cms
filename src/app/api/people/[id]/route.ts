import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { memberUpdateSchema } from "@/lib/validations/auth"
import { getWorkspace } from "@/lib/workspace"
import { Task } from "@/models/task"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

/** Edit someone's record. Owner-only, like every other change to membership. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/people/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const values = memberUpdateSchema.parse(await request.json())

    await connectToDatabase()

    const [member, business] = await Promise.all([
      User.findOne({ _id: id, business: viewer.businessId }),
      getWorkspace(viewer.businessId),
    ])

    if (!member || member.status === "removed") {
      throw new HttpError(404, "That person isn't in this workspace")
    }

    // The workspace has to keep exactly one owner: the account that created
    // it. Demoting it would leave nobody able to invite or approve.
    if (String(business.owner) === String(member._id) && values.role !== "owner") {
      throw new HttpError(409, "The workspace owner can't change their own role")
    }

    if (values.role === "owner" && String(business.owner) !== String(member._id)) {
      throw new HttpError(409, "A workspace has one owner. Use supervisor instead")
    }

    member.name = values.name
    member.phone = values.phone
    member.role = values.role
    member.shift = values.role === "owner" ? undefined : values.shift

    await member.save()

    return ok({ member: toUserDTO(member) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Remove someone from the workspace. The row survives — tasks, check-ins and
 * attendance all point at it — but every route in is closed until another
 * workspace's invite adopts the account.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/people/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params

    await connectToDatabase()

    const [member, business] = await Promise.all([
      User.findOne({ _id: id, business: viewer.businessId }),
      getWorkspace(viewer.businessId),
    ])

    if (!member) {
      throw new HttpError(404, "That person isn't in this workspace")
    }

    if (member.status === "removed") {
      throw new HttpError(409, "They have already been removed")
    }

    if (String(member._id) === viewer.id) {
      throw new HttpError(409, "You can't remove yourself")
    }

    if (String(business.owner) === String(member._id)) {
      throw new HttpError(409, "The workspace owner can't be removed")
    }

    // An open check-in would be stranded: they can no longer reach the app to
    // close it, so the owner has to settle the task first.
    const openTask = await Task.findOne({
      assignee: member._id,
      checkedInAt: { $ne: null },
    })

    if (openTask) {
      throw new HttpError(
        409,
        `${member.name} is still checked in to "${openTask.title}". Close that task first`
      )
    }

    member.status = "removed"
    member.removedAt = new Date()
    await member.save()

    // Work nobody has started goes back on the shelf; anything in progress or
    // finished stays as it is, because it is history now.
    const cancelled = await Task.updateMany(
      { assignee: member._id, status: "pending" },
      { $set: { status: "cancelled" } }
    )

    return ok({
      member: toUserDTO(member),
      cancelledTasks: cancelled.modifiedCount,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

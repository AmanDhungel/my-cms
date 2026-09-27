import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import { logActivity } from "@/lib/activity"
import { cleanWeek } from "@/lib/week-server"
import { connectToDatabase } from "@/lib/mongodb"
import { composeShift, memberUpdateSchema } from "@/lib/validations/auth"
import { getWorkspace } from "@/lib/workspace"
import { Ticket } from "@/models/ticket"
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
    const values = memberUpdateSchema.parse(await readJson(request))

    await connectToDatabase()

    const [member, business] = await Promise.all([
      User.findOne({ _id: id, business: viewer.businessId }),
      getWorkspace(viewer),
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
    const roleBefore = member.role
    member.role = values.role
    member.shift =
      values.role === "owner" || !values.shiftStart || !values.shiftEnd
        ? undefined
        : composeShift(values.shiftStart, values.shiftEnd)

    // Undefined leaves their week alone; null puts them back on the
    // workspace's standard one.
    if (values.week !== undefined) {
      if (values.week === null) member.set("week", undefined)
      else member.set("week", cleanWeek(values.week))
    }

    await member.save()

    await logActivity({
      businessId: viewer.businessId,
      action: "member_updated",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: member.name,
      detail: `${member.role}${member.shift ? ` · shift ${member.shift}` : ""}`,
      targetKind: "member",
      targetId: member._id,
      href: "/dashboard/people",
    })

    if (roleBefore !== member.role) {
      // Audit trail: a role change is recorded on its own.
      void logActivity({
        businessId: viewer.businessId,
        action: "role_changed",
        actorId: viewer.id,
        actorName: viewer.name,
        subject: member.name,
        from: roleBefore,
        to: member.role,
        targetKind: "member",
        targetId: member._id,
        href: "/dashboard/people",
      })
    }

    return ok({ member: toUserDTO(member) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Remove someone from the workspace. The row survives — tickets, check-ins and
 * attendance all point at it — but every route in is closed until another
 * workspace's invite adopts the account.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/people/[id]">
) {
  try {
    const viewer = await requireUser()
    // Deleting a record is the owner's alone (lib/auth/permissions.ts).
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params

    await connectToDatabase()

    const [member, business] = await Promise.all([
      User.findOne({ _id: id, business: viewer.businessId }),
      getWorkspace(viewer),
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
    // close it, so the owner has to settle the ticket first.
    const openTicket = await Ticket.findOne({ "openCheckIns.user": member._id })

    if (openTicket) {
      throw new HttpError(
        409,
        `${member.name} is still checked in to "${openTicket.title}". Close that ticket first`
      )
    }

    member.status = "removed"
    member.removedAt = new Date()
    await member.save()

    // Work nobody has started goes back on the shelf; anything in progress or
    // finished stays as it is, because it is history now.
    const cancelled = await Ticket.updateMany(
      { assignees: member._id, status: "pending" },
      { $set: { status: "cancelled" } }
    )

    await logActivity({
      businessId: viewer.businessId,
      action: "member_removed",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: member.name,
      detail: cancelled.modifiedCount
        ? `${cancelled.modifiedCount} unstarted ticket${cancelled.modifiedCount === 1 ? "" : "s"} cancelled`
        : undefined,
      targetKind: "member",
      targetId: member._id,
      href: "/dashboard/people",
    })

    return ok({
      member: toUserDTO(member),
      cancelledTickets: cancelled.modifiedCount,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

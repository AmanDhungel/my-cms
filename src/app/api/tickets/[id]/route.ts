import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { notifyUser } from "@/lib/notify"
import { ticketSchema } from "@/lib/validations/work"
import { loadCrew, loadTicketForViewer } from "@/lib/tickets"
import { connectToDatabase } from "@/lib/mongodb"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
import { Project } from "@/models/project"
import { toTicketDTO } from "@/models/ticket"

export const runtime = "nodejs"

/** One ticket plus its check-in history — what the detail screen renders. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/tickets/[id]">
) {
  try {
    const viewer = await requireUser()
    const { id } = await ctx.params

    await connectToDatabase()

    const ticket = await loadTicketForViewer(id, viewer)
    await ticket.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    const history = await CheckIn.find({ ticket: ticket._id }).sort({ at: -1 }).limit(50)

    return ok({
      ticket: toTicketDTO(ticket, viewer.id),
      history: history.map(toCheckInDTO),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Edit an assignment. Owners and supervisors only — the assignee moves their
 * ticket along through `/status`, they don't get to rewrite its terms.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tickets/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = ticketSchema.parse(await request.json())

    await connectToDatabase()

    const ticket = await loadTicketForViewer(id, viewer)

    if (ticket.status === "done" || ticket.status === "cancelled") {
      throw new HttpError(409, "That ticket is closed. Reopen it to make changes")
    }

    // Both references are re-scoped to this workspace, so a guessed id can't
    // move a ticket into someone else's org or onto their crew.
    const [crew, project] = await Promise.all([
      loadCrew(values.assigneeIds, viewer.businessId),
      Project.findOne({ _id: values.projectId, business: viewer.businessId }),
    ])

    if (!project) throw new HttpError(422, "That project isn't in this workspace")
    if (project.status === "archived") {
      throw new HttpError(422, "That project is archived")
    }

    const before = new Set((ticket.assignees ?? []).map((id) => String(id)))
    const after = new Set(crew.map((member) => String(member._id)))
    const added = crew.filter((member) => !before.has(String(member._id)))

    // Taking someone off while they are standing on site would strip their
    // open check-in, so that has to be closed out first.
    const stranded = (ticket.openCheckIns ?? []).find(
      (entry) => !after.has(String(entry.user))
    )

    if (stranded) {
      throw new HttpError(
        409,
        "Someone you're removing is checked in. They have to check out first"
      )
    }

    ticket.project = project._id
    ticket.title = values.title
    ticket.description = values.description
    ticket.site = values.site
    ticket.lat = values.lat
    ticket.lng = values.lng
    ticket.radiusM = values.radiusM
    ticket.startAt = new Date(values.startAt)
    ticket.endAt = new Date(values.endAt)
    ticket.assignees = crew.map((member) => member._id)
    ticket.priority = values.priority

    await ticket.save()
    await ticket.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await logActivity({
      businessId: viewer.businessId,
      action: "ticket_updated",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: values.title,
      detail: `${project.name} · ${values.site}`,
      targetKind: "ticket",
      targetId: ticket._id,
      href: "/dashboard/tickets",
    })

    // Only the people newly put on it are told; the rest already knew.
    await Promise.all(
      added
        .filter((member) => String(member._id) !== viewer.id)
        .map((member) =>
          notifyUser({
            businessId: viewer.businessId,
            userId: member._id,
            kind: "ticket_assigned",
            title: `New ticket: ${values.title}`,
            body: `${project.name} · ${values.site}`,
            href: "/dashboard",
            actor: viewer.id,
            ticket: ticket._id,
          })
        )
    )

    return ok({ ticket: toTicketDTO(ticket, viewer.id) })
  } catch (error) {
    return handleApiError(error)
  }
}

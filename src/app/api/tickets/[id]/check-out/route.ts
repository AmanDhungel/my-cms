import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { markDeparture } from "@/lib/attendance"
import { distanceInMetres, formatDistance } from "@/lib/geo"
import { notifySupervisors } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { shiftOn } from "@/lib/week-server"
import { loadTicketForViewer } from "@/lib/tickets"
import { checkInSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
import { toAttendanceDTO } from "@/models/attendance"
import { toTicketDTO } from "@/models/ticket"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Departure. Leaving does not complete the ticket — someone can come back to it
 * later — so the status only moves when the assignee says it's done.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tickets/[id]/check-out">
) {
  try {
    const viewer = await requireRole("employee", "supervisor")
    const { id } = await ctx.params
    const values = checkInSchema.parse(await request.json())

    await connectToDatabase()

    const ticket = await loadTicketForViewer(id, viewer)

    // Guards a double submit from the other direction, again per person.
    const mine = (ticket.openCheckIns ?? []).find(
      (entry) => String(entry.user) === viewer.id
    )

    if (!mine) {
      throw new HttpError(409, "You aren't checked in to this ticket")
    }

    const distanceM = distanceInMetres(
      { lat: values.lat, lng: values.lng },
      { lat: ticket.lat, lng: ticket.lng }
    )
    const insideFence = distanceM <= ticket.radiusM
    const at = new Date()

    const entry = await CheckIn.create({
      business: ticket.business,
      ticket: ticket._id,
      user: viewer.id,
      type: "out",
      at,
      lat: values.lat,
      lng: values.lng,
      accuracyM: values.accuracyM,
      distanceM,
      insideFence,
      reason: insideFence ? undefined : values.reason,
    })

    // `set` rather than assignment: the field is a mongoose DocumentArray,
    // which a plain array does not satisfy.
    ticket.set(
      "openCheckIns",
      ticket.openCheckIns.filter((entry) => String(entry.user) !== viewer.id)
    )
    ticket.checkedOutAt = at
    await ticket.save()

    const [business, me] = await Promise.all([
      getWorkspace(viewer.businessId),
      User.findById(viewer.id).select("shift week"),
    ])

    const attendance = await markDeparture({
      businessId: ticket.business,
      userId: viewer.id,
      at,
      source: "derived",
      shift: shiftOn(dayKeyInZone(at, business.timeZone), me, business),
      timeZone: business.timeZone,
    })

    await ticket.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await logActivity({
      businessId: ticket.business,
      action: "ticket_checked_out",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: ticket.title,
      detail: insideFence
        ? ticket.site
        : `${ticket.site} · left from ${formatDistance(distanceM)} away`,
      targetKind: "ticket",
      targetId: ticket._id,
      href: "/dashboard/tickets",
      at,
    })

    await notifySupervisors({
      businessId: ticket.business,
      kind: "check_out",
      title: `${viewer.name} checked out of ${ticket.site}`,
      body: insideFence
        ? ticket.title
        : `${ticket.title} · left from ${formatDistance(distanceM)} away`,
      href: "/dashboard/tickets",
      actor: viewer.id,
      ticket: ticket._id,
    })

    return ok(
      {
        ticket: toTicketDTO(ticket, viewer.id),
        checkIn: toCheckInDTO(entry),
        attendance: toAttendanceDTO(attendance),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}

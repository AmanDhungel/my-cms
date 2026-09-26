import { Types } from "mongoose"

import { HttpError, fail, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { markArrival } from "@/lib/attendance"
import { distanceInMetres, formatDistance } from "@/lib/geo"
import { clockInZone, dayKeyInZone } from "@/lib/time"
import { CHECK_IN_OPENS_MIN } from "@/lib/work-constants"
import { notifySupervisors } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { shiftOn } from "@/lib/week-server"
import { loadTicketForViewer } from "@/lib/tickets"
import { PAST_TICKET_MESSAGE, isPastTicket } from "@/lib/ticket-window"
import { OVERTIME_REASON_MESSAGE, classifyOvertime, shiftToday } from "@/lib/overtime"
import { checkInSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
import { toAttendanceDTO } from "@/models/attendance"
import { toTicketDTO } from "@/models/ticket"
import { User } from "@/models/user"

export const runtime = "nodejs"


/**
 * Arrival at a ticket. The distance is measured here, never in the browser —
 * the client only reports where it thinks it is.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tickets/[id]/check-in">
) {
  try {
    const viewer = await requireRole("employee", "supervisor")
    const { id } = await ctx.params
    const values = checkInSchema.parse(await request.json())

    await connectToDatabase()

    const ticket = await loadTicketForViewer(id, viewer)
    const business = await getWorkspace(viewer.businessId)

    // A past ticket is view-only for the crew — the same rule the app uses
    // to hide the button, decided here with the server's own clock.
    if (
      viewer.role === "employee" &&
      isPastTicket(ticket, new Date(), business.timeZone)
    ) {
      throw new HttpError(403, PAST_TICKET_MESSAGE)
    }

    if (ticket.status === "done" || ticket.status === "cancelled") {
      throw new HttpError(409, "That ticket is already closed")
    }

    // Check-in opens shortly before the ticket does, so nobody can start their
    // day against a job that isn't due for hours.
    const opensAt = new Date(ticket.startAt.getTime() - CHECK_IN_OPENS_MIN * 60_000)

    if (Date.now() < opensAt.getTime()) {
      throw new HttpError(
        409,
        `Check-in opens at ${clockInZone(opensAt, business.timeZone)}, ${CHECK_IN_OPENS_MIN} minutes before the ticket starts`
      )
    }

    // Per person, not per ticket: with a crew on one job, someone else being
    // on site says nothing about whether you are.
    if (
      (ticket.openCheckIns ?? []).some(
        (entry) => String(entry.user) === viewer.id
      )
    ) {
      throw new HttpError(409, "You're already checked in to this ticket")
    }

    const distanceM = distanceInMetres(
      { lat: values.lat, lng: values.lng },
      { lat: ticket.lat, lng: ticket.lng }
    )
    const insideFence = distanceM <= ticket.radiusM

    // Overtime is decided here, from the server's clock and the shift this
    // server resolves — never from anything the client says.
    const at = new Date()
    const me = await User.findById(viewer.id).select("shift week")
    const overtime = classifyOvertime(
      at,
      shiftToday(at, me, business, business.timeZone),
      business.timeZone
    )

    // Both questions answered in one go, so nobody is asked twice.
    const missing: Record<string, string[]> = {}
    if (!insideFence && !values.reason) {
      missing.reason = [
        `You're outside the ${formatDistance(ticket.radiusM)} check-in area. A reason is required.`,
      ]
    }
    if (overtime.overtime && !values.overtimeReason) {
      missing.overtimeReason = [OVERTIME_REASON_MESSAGE]
    }
    if (Object.keys(missing).length > 0) {
      return fail(
        missing.reason
          ? `You're ${formatDistance(distanceM)} from ${ticket.site}. Say why before checking in.`
          : OVERTIME_REASON_MESSAGE,
        422,
        missing
      )
    }

    const entry = await CheckIn.create({
      business: ticket.business,
      ticket: ticket._id,
      user: viewer.id,
      type: "in",
      at,
      lat: values.lat,
      lng: values.lng,
      accuracyM: values.accuracyM,
      distanceM,
      insideFence,
      reason: insideFence ? undefined : values.reason,
      ...(overtime.overtime
        ? { overtime: true, overtimeReason: values.overtimeReason }
        : {}),
    })

    ticket.openCheckIns.push({ user: new Types.ObjectId(viewer.id), at })
    if (ticket.status === "pending" || ticket.status === "blocked") {
      ticket.status = "in_progress"
      ticket.blockedReason = undefined
    }
    await ticket.save()

    const attendance = await markArrival({
      businessId: ticket.business,
      userId: viewer.id,
      at,
      source: "derived",
      shift: shiftOn(dayKeyInZone(at, business.timeZone), me, business),
      timeZone: business.timeZone,
    })

    if (overtime.overtime) {
      attendance.overtime = true
      attendance.overtimeReason = values.overtimeReason
      await attendance.save()
    }

    await ticket.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await logActivity({
      businessId: ticket.business,
      action: "ticket_checked_in",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: ticket.title,
      detail: insideFence
        ? `${ticket.site} · ${formatDistance(distanceM)} from the marker`
        : `${ticket.site} · outside the area (${formatDistance(distanceM)}) — "${values.reason}"`,
      targetKind: "ticket",
      targetId: ticket._id,
      href: "/dashboard/tickets",
      at,
    })

    await notifySupervisors({
      businessId: ticket.business,
      kind: "check_in",
      title: `${viewer.name} checked in at ${ticket.site}`,
      body: insideFence
        ? `${ticket.title} · ${formatDistance(distanceM)} from the marker`
        : `Outside the area (${formatDistance(distanceM)}) — "${values.reason}"`,
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

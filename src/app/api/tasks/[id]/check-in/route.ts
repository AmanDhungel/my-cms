import { Types } from "mongoose"

import { HttpError, fail, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { markArrival } from "@/lib/attendance"
import { distanceInMetres, formatDistance } from "@/lib/geo"
import { clockInZone } from "@/lib/time"
import { CHECK_IN_OPENS_MIN } from "@/lib/work-constants"
import { notifySupervisors } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { loadTaskForViewer } from "@/lib/tasks"
import { checkInSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
import { toAttendanceDTO } from "@/models/attendance"
import { toTaskDTO } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"


/**
 * Arrival at a task. The distance is measured here, never in the browser —
 * the client only reports where it thinks it is.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/check-in">
) {
  try {
    const viewer = await requireRole("employee", "supervisor")
    const { id } = await ctx.params
    const values = checkInSchema.parse(await request.json())

    await connectToDatabase()

    const task = await loadTaskForViewer(id, viewer)
    const business = await getWorkspace(viewer.businessId)

    if (task.status === "done" || task.status === "cancelled") {
      throw new HttpError(409, "That task is already closed")
    }

    // Check-in opens shortly before the task does, so nobody can start their
    // day against a job that isn't due for hours.
    const opensAt = new Date(task.startAt.getTime() - CHECK_IN_OPENS_MIN * 60_000)

    if (Date.now() < opensAt.getTime()) {
      throw new HttpError(
        409,
        `Check-in opens at ${clockInZone(opensAt, business.timeZone)}, ${CHECK_IN_OPENS_MIN} minutes before the task starts`
      )
    }

    // Per person, not per task: with a crew on one job, someone else being
    // on site says nothing about whether you are.
    if (
      (task.openCheckIns ?? []).some(
        (entry) => String(entry.user) === viewer.id
      )
    ) {
      throw new HttpError(409, "You're already checked in to this task")
    }

    const distanceM = distanceInMetres(
      { lat: values.lat, lng: values.lng },
      { lat: task.lat, lng: task.lng }
    )
    const insideFence = distanceM <= task.radiusM

    if (!insideFence && !values.reason) {
      return fail(
        `You're ${formatDistance(distanceM)} from ${task.site}. Say why before checking in.`,
        422,
        {
          reason: [
            `You're outside the ${formatDistance(task.radiusM)} check-in area. A reason is required.`,
          ],
        }
      )
    }

    const at = new Date()

    const entry = await CheckIn.create({
      business: task.business,
      task: task._id,
      user: viewer.id,
      type: "in",
      at,
      lat: values.lat,
      lng: values.lng,
      accuracyM: values.accuracyM,
      distanceM,
      insideFence,
      reason: insideFence ? undefined : values.reason,
    })

    task.openCheckIns.push({ user: new Types.ObjectId(viewer.id), at })
    if (task.status === "pending" || task.status === "blocked") {
      task.status = "in_progress"
      task.blockedReason = undefined
    }
    await task.save()

    const me = await User.findById(viewer.id).select("shift")

    const attendance = await markArrival({
      businessId: task.business,
      userId: viewer.id,
      at,
      source: "derived",
      shift: me?.shift,
      timeZone: business.timeZone,
    })

    await task.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await notifySupervisors({
      businessId: task.business,
      kind: "check_in",
      title: `${viewer.name} checked in at ${task.site}`,
      body: insideFence
        ? `${task.title} · ${formatDistance(distanceM)} from the marker`
        : `Outside the area (${formatDistance(distanceM)}) — "${values.reason}"`,
      href: "/dashboard/tasks",
      actor: viewer.id,
      task: task._id,
    })

    return ok(
      {
        task: toTaskDTO(task, viewer.id),
        checkIn: toCheckInDTO(entry),
        attendance: toAttendanceDTO(attendance),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}

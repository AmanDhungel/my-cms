import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { markDeparture } from "@/lib/attendance"
import { distanceInMetres, formatDistance } from "@/lib/geo"
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
 * Departure. Leaving does not complete the task — someone can come back to it
 * later — so the status only moves when the assignee says it's done.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/check-out">
) {
  try {
    const viewer = await requireRole("employee", "supervisor")
    const { id } = await ctx.params
    const values = checkInSchema.parse(await request.json())

    await connectToDatabase()

    const task = await loadTaskForViewer(id, viewer)

    // Guards a double submit from the other direction, again per person.
    const mine = (task.openCheckIns ?? []).find(
      (entry) => String(entry.user) === viewer.id
    )

    if (!mine) {
      throw new HttpError(409, "You aren't checked in to this task")
    }

    const distanceM = distanceInMetres(
      { lat: values.lat, lng: values.lng },
      { lat: task.lat, lng: task.lng }
    )
    const insideFence = distanceM <= task.radiusM
    const at = new Date()

    const entry = await CheckIn.create({
      business: task.business,
      task: task._id,
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
    task.set(
      "openCheckIns",
      task.openCheckIns.filter((entry) => String(entry.user) !== viewer.id)
    )
    task.checkedOutAt = at
    await task.save()

    const [business, me] = await Promise.all([
      getWorkspace(viewer.businessId),
      User.findById(viewer.id).select("shift"),
    ])

    const attendance = await markDeparture({
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
      kind: "check_out",
      title: `${viewer.name} checked out of ${task.site}`,
      body: insideFence
        ? task.title
        : `${task.title} · left from ${formatDistance(distanceM)} away`,
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

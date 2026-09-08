import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { markDeparture } from "@/lib/attendance"
import { notifySupervisors } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { loadTaskForViewer } from "@/lib/tasks"
import { taskStatusSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { toTaskDTO } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"

/** The assignee moving their own task along, or an owner correcting it. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/status">
) {
  try {
    const viewer = await requireUser()
    const { id } = await ctx.params
    const values = taskStatusSchema.parse(await request.json())

    await connectToDatabase()

    const task = await loadTaskForViewer(id, viewer)

    if (task.status === "cancelled") {
      throw new HttpError(409, "That task was cancelled")
    }

    if (task.status === values.status) {
      throw new HttpError(409, `That task is already ${label(values.status)}`)
    }

    task.status = values.status
    task.blockedReason =
      values.status === "blocked" ? values.blockedReason : undefined

    // Finishing while still checked in closes the visit, so attendance isn't
    // left open for the rest of the day.
    if (values.status === "done" && task.checkedInAt) {
      const at = new Date()
      task.checkedInAt = undefined
      task.checkedOutAt = at

      const [business, me] = await Promise.all([
        getWorkspace(viewer.businessId),
        User.findById(viewer.id).select("shift"),
      ])

      await markDeparture({
        businessId: task.business,
        userId: viewer.id,
        at,
        source: "derived",
        shift: me?.shift,
        timeZone: business.timeZone,
      })
    }

    await task.save()
    await task.populate([
      { path: "assignee", select: "name" },
      { path: "project", select: "name" },
    ])

    // Only the two states an owner needs to hear about unprompted.
    if (values.status === "blocked" || values.status === "done") {
      await notifySupervisors({
        businessId: task.business,
        kind: values.status === "blocked" ? "task_blocked" : "task_done",
        title:
          values.status === "blocked"
            ? `${viewer.name} is blocked on ${task.title}`
            : `${viewer.name} finished ${task.title}`,
        body:
          values.status === "blocked" ? values.blockedReason : task.site,
        href: "/dashboard/tasks",
        actor: viewer.id,
        task: task._id,
      })
    }

    return ok({ task: toTaskDTO(task) })
  } catch (error) {
    return handleApiError(error)
  }
}

function label(status: string) {
  return status === "in_progress" ? "in progress" : status
}

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { notifyUser } from "@/lib/notify"
import { taskSchema } from "@/lib/validations/work"
import { loadCrew, loadTaskForViewer } from "@/lib/tasks"
import { connectToDatabase } from "@/lib/mongodb"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
import { Project } from "@/models/project"
import { toTaskDTO } from "@/models/task"

export const runtime = "nodejs"

/** One task plus its check-in history — what the detail screen renders. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  try {
    const viewer = await requireUser()
    const { id } = await ctx.params

    await connectToDatabase()

    const task = await loadTaskForViewer(id, viewer)
    await task.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    const history = await CheckIn.find({ task: task._id }).sort({ at: -1 }).limit(50)

    return ok({
      task: toTaskDTO(task, viewer.id),
      history: history.map(toCheckInDTO),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Edit an assignment. Owners and supervisors only — the assignee moves their
 * task along through `/status`, they don't get to rewrite its terms.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = taskSchema.parse(await request.json())

    await connectToDatabase()

    const task = await loadTaskForViewer(id, viewer)

    if (task.status === "done" || task.status === "cancelled") {
      throw new HttpError(409, "That task is closed. Reopen it to make changes")
    }

    // Both references are re-scoped to this workspace, so a guessed id can't
    // move a task into someone else's org or onto their crew.
    const [crew, project] = await Promise.all([
      loadCrew(values.assigneeIds, viewer.businessId),
      Project.findOne({ _id: values.projectId, business: viewer.businessId }),
    ])

    if (!project) throw new HttpError(422, "That project isn't in this workspace")
    if (project.status === "archived") {
      throw new HttpError(422, "That project is archived")
    }

    const before = new Set((task.assignees ?? []).map((id) => String(id)))
    const after = new Set(crew.map((member) => String(member._id)))
    const added = crew.filter((member) => !before.has(String(member._id)))

    // Taking someone off while they are standing on site would strip their
    // open check-in, so that has to be closed out first.
    const stranded = (task.openCheckIns ?? []).find(
      (entry) => !after.has(String(entry.user))
    )

    if (stranded) {
      throw new HttpError(
        409,
        "Someone you're removing is checked in. They have to check out first"
      )
    }

    task.project = project._id
    task.title = values.title
    task.description = values.description
    task.site = values.site
    task.lat = values.lat
    task.lng = values.lng
    task.radiusM = values.radiusM
    task.startAt = new Date(values.startAt)
    task.endAt = new Date(values.endAt)
    task.assignees = crew.map((member) => member._id)
    task.priority = values.priority

    await task.save()
    await task.populate([
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    // Only the people newly put on it are told; the rest already knew.
    await Promise.all(
      added
        .filter((member) => String(member._id) !== viewer.id)
        .map((member) =>
          notifyUser({
            businessId: viewer.businessId,
            userId: member._id,
            kind: "task_assigned",
            title: `New task: ${values.title}`,
            body: `${project.name} · ${values.site}`,
            href: "/dashboard",
            actor: viewer.id,
            task: task._id,
          })
        )
    )

    return ok({ task: toTaskDTO(task, viewer.id) })
  } catch (error) {
    return handleApiError(error)
  }
}

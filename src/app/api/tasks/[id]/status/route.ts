import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { markDeparture } from "@/lib/attendance"
import { notifySupervisors, notifyUser } from "@/lib/notify"
import { connectToDatabase } from "@/lib/mongodb"
import { loadTaskForViewer } from "@/lib/tasks"
import { taskStatusSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { toTaskDTO, type TaskStatus } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Who may move a task where.
 *
 * The assignee runs their own work up to "ready for review" but can't sign it
 * off — that's the whole point of a review column. Owners and supervisors move
 * it anywhere, including back down the board.
 */
const ASSIGNEE_CAN_SET: readonly TaskStatus[] = [
  "in_progress",
  "blocked",
  "in_review",
]

/** Reaching either of these means the visit is over. */
const CLOSES_THE_VISIT: readonly TaskStatus[] = ["in_review", "done"]

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

    const isReviewer = viewer.role !== "employee"

    // Permission is settled before position: "you can't move it there" is a
    // truer answer than "it's already there" when both would apply.
    if (!isReviewer && !ASSIGNEE_CAN_SET.includes(values.status)) {
      throw new HttpError(
        403,
        values.status === "done"
          ? "Send it for review — your owner signs work off"
          : "You can't move a task there"
      )
    }

    if (task.status === values.status) {
      throw new HttpError(409, `That task is already ${label(values.status)}`)
    }

    task.status = values.status
    task.blockedReason =
      values.status === "blocked" ? values.blockedReason : undefined

    // Handing work over while still checked in closes the visit, so attendance
    // isn't left open for the rest of the day. Only the acting person's visit
    // closes — a crewmate still on site keeps theirs.
    const myVisit = (task.openCheckIns ?? []).find(
      (entry) => String(entry.user) === viewer.id
    )

    if (CLOSES_THE_VISIT.includes(values.status) && myVisit) {
      const at = new Date()
      task.set(
        "openCheckIns",
        task.openCheckIns.filter((entry) => String(entry.user) !== viewer.id)
      )
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
      { path: "assignees", select: "name" },
      { path: "project", select: "name" },
    ])

    await announce(task, values, viewer, isReviewer)

    return ok({ task: toTaskDTO(task, viewer.id) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Work moving up the board tells the owners; a decision coming back down
 * tells the person who did the work. Nobody is told about their own action.
 */
async function announce(
  task: Awaited<ReturnType<typeof loadTaskForViewer>>,
  values: { status: TaskStatus; blockedReason?: string },
  viewer: { id: string; name: string; businessId: string },
  isReviewer: boolean
) {
  const shared = {
    businessId: task.business,
    href: "/dashboard/tasks",
    actor: viewer.id,
    task: task._id,
  }

  if (values.status === "blocked") {
    await notifySupervisors({
      ...shared,
      kind: "task_blocked",
      title: `${viewer.name} is blocked on ${task.title}`,
      body: values.blockedReason,
    })
    return
  }

  if (values.status === "in_review") {
    await notifySupervisors({
      ...shared,
      kind: "task_in_review",
      title: `${viewer.name} sent ${task.title} for review`,
      body: task.site,
    })
    return
  }

  if (values.status === "done") {
    // A reviewer signing off is news for the crew who did the work; anyone
    // who signed off their own task needs no notification about it.
    if (isReviewer) {
      const crew = (task.assignees ?? [])
        .map((ref) => String((ref as { _id?: unknown })?._id ?? ref))
        .filter((id) => id !== viewer.id)

      await Promise.all(
        crew.map((userId) =>
          notifyUser({
            ...shared,
            userId,
            kind: "task_done",
            title: `${task.title} was signed off`,
            body: task.site,
          })
        )
      )
      return
    }

    await notifySupervisors({
      ...shared,
      kind: "task_done",
      title: `${viewer.name} finished ${task.title}`,
      body: task.site,
    })
  }
}

function label(status: string) {
  if (status === "in_progress") return "in progress"
  if (status === "in_review") return "in review"
  return status
}

import { handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { loadTaskForViewer } from "@/lib/tasks"
import { connectToDatabase } from "@/lib/mongodb"
import { CheckIn, toCheckInDTO } from "@/models/check-in"
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
      { path: "assignee", select: "name" },
      { path: "project", select: "name" },
    ])

    const history = await CheckIn.find({ task: task._id }).sort({ at: -1 }).limit(50)

    return ok({ task: toTaskDTO(task), history: history.map(toCheckInDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

import { HttpError } from "@/lib/api-response"
import type { SessionUser } from "@/lib/auth/guards"
import { Task } from "@/models/task"
import { User } from "@/models/user"

/**
 * Loads a task inside the viewer's workspace. Employees are additionally
 * scoped to their own assignments, so a guessed id reveals nothing.
 */
export async function loadTaskForViewer(id: string, viewer: SessionUser) {
  const filter: Record<string, unknown> = {
    _id: id,
    business: viewer.businessId,
  }

  if (viewer.role === "employee") {
    filter.assignees = viewer.id
  }

  const task = await Task.findOne(filter)

  if (!task) {
    throw new HttpError(404, "That task doesn't exist")
  }

  return task
}

/**
 * Resolves an assignee list to active members of the viewer's workspace.
 * Every id has to check out — a partially valid list is a mistake worth
 * refusing rather than silently trimming.
 */
export async function loadCrew(ids: string[], businessId: string) {
  const unique = [...new Set(ids)]

  const crew = await User.find({
    _id: { $in: unique },
    business: businessId,
    status: "active",
  }).select("_id name")

  if (crew.length !== unique.length) {
    throw new HttpError(422, "Someone on that list isn't in this workspace")
  }

  return crew
}

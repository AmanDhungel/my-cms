import { HttpError } from "@/lib/api-response"
import type { SessionUser } from "@/lib/auth/guards"
import { Task } from "@/models/task"

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
    filter.assignee = viewer.id
  }

  const task = await Task.findOne(filter)

  if (!task) {
    throw new HttpError(404, "That task doesn't exist")
  }

  return task
}

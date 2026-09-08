import type { NextRequest } from "next/server"
import { Types } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { taskSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { notifyUser } from "@/lib/notify"
import { Project } from "@/models/project"
import { Task, toTaskDTO } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"

const SCOPES = ["today", "upcoming", "done", "all"] as const
type Scope = (typeof SCOPES)[number]

/**
 * Employees only ever see their own tasks — the filter is derived from the
 * session, never from a query parameter, so it can't be widened by the client.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const params = request.nextUrl.searchParams
    const scope = asScope(params.get("scope"))

    const filter: Record<string, unknown> = { business: business._id }

    if (viewer.role === "employee") {
      filter.assignee = viewer.id
    } else {
      const assigneeId = params.get("assigneeId")
      if (assigneeId && Types.ObjectId.isValid(assigneeId)) {
        filter.assignee = assigneeId
      }
    }

    const projectId = params.get("projectId")
    if (projectId && Types.ObjectId.isValid(projectId)) {
      filter.project = projectId
    }

    if (scope === "today") {
      const { start, end } = dayRangeInZone(
        dayKeyInZone(new Date(), business.timeZone),
        business.timeZone
      )
      filter.startAt = { $gte: start, $lt: end }
      filter.status = { $nin: ["cancelled"] }
    } else if (scope === "upcoming") {
      filter.startAt = { $gte: new Date() }
      filter.status = { $in: ["pending", "in_progress", "blocked"] }
    } else if (scope === "done") {
      filter.status = { $in: ["done", "cancelled"] }
    }

    const tasks = await Task.find(filter)
      .sort(scope === "done" ? { startAt: -1 } : { startAt: 1 })
      .limit(200)
      .populate([
        { path: "assignee", select: "name" },
        { path: "project", select: "name" },
      ])

    return ok({ tasks: tasks.map(toTaskDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Owners and supervisors assign work; employees never create their own. */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = taskSchema.parse(await request.json())

    await connectToDatabase()

    // The assignee has to belong to this workspace — otherwise an owner could
    // assign work into someone else's org by guessing an id.
    const assignee = await User.findOne({
      _id: values.assigneeId,
      business: viewer.businessId,
    })

    if (!assignee) {
      throw new HttpError(422, "That person isn't in this workspace")
    }

    // Same scoping rule for the project: a guessed id can't reach another org.
    const project = await Project.findOne({
      _id: values.projectId,
      business: viewer.businessId,
    })

    if (!project) {
      throw new HttpError(422, "That project isn't in this workspace")
    }

    if (project.status === "archived") {
      throw new HttpError(422, "That project is archived")
    }

    const task = await Task.create({
      business: viewer.businessId,
      project: project._id,
      title: values.title,
      description: values.description,
      site: values.site,
      lat: values.lat,
      lng: values.lng,
      radiusM: values.radiusM,
      startAt: new Date(values.startAt),
      endAt: new Date(values.endAt),
      assignee: assignee._id,
      assignedBy: viewer.id,
      priority: values.priority,
      status: "pending",
    })

    await task.populate([
      { path: "assignee", select: "name" },
      { path: "project", select: "name" },
    ])

    await notifyUser({
      businessId: viewer.businessId,
      userId: assignee._id,
      kind: "task_assigned",
      title: `New task: ${values.title}`,
      body: `${project.name} · ${values.site}`,
      href: "/dashboard",
      actor: viewer.id,
      task: task._id,
    })

    return ok({ task: toTaskDTO(task) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

function asScope(value: string | null): Scope {
  return SCOPES.includes(value as Scope) ? (value as Scope) : "all"
}

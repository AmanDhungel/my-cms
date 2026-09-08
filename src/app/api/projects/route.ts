import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { projectSchema } from "@/lib/validations/work"
import { Project, toProjectDTO } from "@/models/project"
import { Task } from "@/models/task"

export const runtime = "nodejs"

/**
 * Projects for the workspace, each with the task counts the board shows.
 * Employees can read them so their task cards can name the project.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const status = request.nextUrl.searchParams.get("status")
    const filter: Record<string, unknown> = { business: viewer.businessId }
    if (status === "active" || status === "archived") filter.status = status

    const projects = await Project.find(filter).sort({ createdAt: -1 }).limit(200)

    // One grouped query rather than a count per project.
    const grouped = await Task.aggregate<{
      _id: { project: unknown; status: string }
      n: number
    }>([
      { $match: { project: { $in: projects.map((p) => p._id) } } },
      { $group: { _id: { project: "$project", status: "$status" }, n: { $sum: 1 } } },
    ])

    const counts = new Map<string, Record<string, number>>()
    for (const row of grouped) {
      const key = String(row._id.project)
      const bucket = counts.get(key) ?? {}
      bucket[row._id.status] = row.n
      counts.set(key, bucket)
    }

    return ok({
      projects: projects.map((project) => {
        const bucket = counts.get(String(project._id)) ?? {}
        const total = Object.values(bucket).reduce((sum, n) => sum + n, 0)
        return {
          ...toProjectDTO(project),
          tasks: {
            total,
            open: (bucket.pending ?? 0) + (bucket.in_progress ?? 0),
            blocked: bucket.blocked ?? 0,
            done: bucket.done ?? 0,
          },
        }
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Owners and supervisors create projects; the crew never does. */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = projectSchema.parse(await request.json())

    await connectToDatabase()

    const project = await Project.create({
      business: viewer.businessId,
      name: values.name,
      description: values.description,
      site: values.site,
      createdBy: viewer.id,
      status: "active",
    })

    return ok({ project: toProjectDTO(project) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

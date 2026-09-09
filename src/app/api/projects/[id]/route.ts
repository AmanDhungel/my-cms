import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { projectUpdateSchema } from "@/lib/validations/work"
import { Project, toProjectDTO } from "@/models/project"
import { Task } from "@/models/task"

export const runtime = "nodejs"

/**
 * Edit a project, or archive and reopen it. Projects are never deleted —
 * tasks reference them, and deleting one would orphan its history.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/projects/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = projectUpdateSchema.parse(await request.json())

    await connectToDatabase()

    const project = await Project.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!project) throw new HttpError(404, "That project doesn't exist")

    if ("status" in values) {
      if (project.status === values.status) {
        throw new HttpError(409, `That project is already ${values.status}`)
      }

      project.status = values.status
      await project.save()

      // Archiving cancels the work nobody has started; anything in progress is
      // left alone so a check-in already under way isn't torn out from under it.
      if (values.status === "archived") {
        await Task.updateMany(
          { project: project._id, status: "pending" },
          { $set: { status: "cancelled" } }
        )
      }

      return ok({ project: toProjectDTO(project) })
    }

    project.name = values.name
    project.description = values.description
    project.site = values.site
    await project.save()

    return ok({ project: toProjectDTO(project) })
  } catch (error) {
    return handleApiError(error)
  }
}

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { connectToDatabase } from "@/lib/mongodb"
import { loadCrew } from "@/lib/tasks"
import {
  operationSchema,
  operationStatusSchema,
} from "@/lib/validations/operations"
import { Operation, toOperationDTO } from "@/models/operation"
import {
  OPERATION_POPULATE,
  describeOperation,
  hrefFor,
  scopedCustomer,
  scopedProject,
} from "@/lib/operations-server"

export const runtime = "nodejs"

/** The full edit. Everything the dialog holds is rewritten from the payload. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/operations/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const body = await request.json()

    await connectToDatabase()

    const entry = await Operation.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!entry) throw new HttpError(404, "That entry doesn't exist")

    /**
     * Ticking a row off is a one-field payload from a list, so it is taken
     * first — the full schema would reject it for everything it leaves out.
     */
    const onlyStatus = Object.keys(body).length === 1 && "status" in body

    if (onlyStatus) {
      const { status } = operationStatusSchema.parse(body)

      if (entry.status === status) {
        throw new HttpError(409, `That is already ${status}`)
      }

      const cameFrom = entry.status
      entry.status = status
      entry.completedAt = status === "done" ? new Date() : undefined
      await entry.save()
      await entry.populate(OPERATION_POPULATE)

      await logActivity({
        businessId: viewer.businessId,
        action: "operation_status",
        actorId: viewer.id,
        actorName: viewer.name,
        subject: entry.title,
        from: cameFrom,
        to: status,
        targetKind: "operation",
        targetId: entry._id,
        href: hrefFor(entry.kind),
      })

      return ok({ operation: toOperationDTO(entry) })
    }

    const values = operationSchema.parse(body)

    const [crew, customer, project] = await Promise.all([
      values.assigneeIds.length
        ? loadCrew(values.assigneeIds, viewer.businessId)
        : [],
      scopedCustomer(values.customerId, viewer.businessId),
      scopedProject(values.projectId, viewer.businessId),
    ])

    entry.kind = values.kind
    entry.title = values.title
    entry.details = values.details
    entry.startAt = new Date(values.startAt)
    entry.endAt = values.endAt ? new Date(values.endAt) : undefined
    entry.allDay = values.allDay
    entry.status = values.status
    entry.priority = values.priority
    entry.set("assignees", crew.map((member) => member._id))
    entry.customer = customer?._id
    entry.project = project?._id
    entry.location = values.location
    // Losing "done" clears the moment it was finished, so it can't outlive it.
    entry.completedAt =
      values.status === "done" ? (entry.completedAt ?? new Date()) : undefined

    await entry.save()
    await entry.populate(OPERATION_POPULATE)

    await logActivity({
      businessId: viewer.businessId,
      action: "operation_updated",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: values.title,
      detail: describeOperation(values.kind, values.startAt, values.location),
      targetKind: "operation",
      targetId: entry._id,
      href: hrefFor(values.kind),
    })

    return ok({ operation: toOperationDTO(entry) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/operations/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()

    const entry = await Operation.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!entry) throw new HttpError(404, "That entry doesn't exist")

    await logActivity({
      businessId: viewer.businessId,
      action: "operation_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: entry.title,
      detail: describeOperation(
        entry.kind,
        entry.startAt.toISOString(),
        entry.location ?? undefined
      ),
      targetKind: "operation",
      targetId: entry._id,
      href: hrefFor(entry.kind),
    })

    return ok({ id: String(entry._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

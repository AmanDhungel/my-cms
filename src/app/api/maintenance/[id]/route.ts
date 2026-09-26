import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { ownParty } from "@/lib/money-refs"
import { connectToDatabase } from "@/lib/mongodb"
import { deleteUploads, reconcileUploads } from "@/lib/s3"
import { dayRangeInZone } from "@/lib/time"
import { maintenanceSchema } from "@/lib/validations/maintenance"
import { getWorkspace } from "@/lib/workspace"
import { prettyState } from "@/lib/activity-labels"
import { MaintenanceItem, toMaintenanceDTO } from "@/models/maintenance"

export const runtime = "nodejs"

async function findOwn(businessId: string, id: string) {
  const row = await MaintenanceItem.findOne({ _id: id, business: businessId })
  if (!row) throw new HttpError(404, "That item isn't on the bench")
  return row
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/maintenance/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = maintenanceSchema.parse(await request.json())

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)
    const row = await findOwn(viewer.businessId, id)
    const day = (key: string) => dayRangeInZone(key, business.timeZone).start

    const cameFrom = row.status
    // What it pointed at before, so dropped pictures can be cleared out.
    const before = [...(row.photos ?? [])]

    row.item = values.item
    row.makeModel = values.makeModel
    row.serialNumber = values.serialNumber
    row.owner = values.owner
    row.ownerRef = await ownParty(viewer.businessId, values.ownerId)
    row.fault = values.fault
    row.diagnosis = values.diagnosis
    row.status = values.status
    row.receivedAt = day(values.receivedAt)
    row.dueAt = values.dueAt ? day(values.dueAt) : undefined
    row.returnedAt = values.returnedAt ? day(values.returnedAt) : undefined
    row.cost = values.cost
    row.assignee = values.assigneeId as never
    row.set("photos", values.photos)
    row.note = values.note
    await row.save()

    /*
     * Tidying happens here rather than in the browser: a closed tab would
     * otherwise leave an orphan in the bucket for ever. Not awaited, because
     * a bucket that refuses a delete must not fail a save already made.
     */
    void reconcileUploads(before, values.photos, viewer.businessId)

    void logActivity({
      businessId: viewer.businessId,
      action:
        cameFrom === values.status
          ? "maintenance_updated"
          : "maintenance_status",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: values.serialNumber
        ? `${values.item} (${values.serialNumber})`
        : values.item,
      from: cameFrom === values.status ? undefined : prettyState(cameFrom),
      to: cameFrom === values.status ? undefined : prettyState(values.status),
      targetKind: "maintenance",
      targetId: row._id,
      href: "/dashboard/maintenance",
    })

    await row.populate("assignee", "name")
    return ok({ item: toMaintenanceDTO(row, business.timeZone) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Remove it, and its photographs with it. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/maintenance/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()
    const row = await findOwn(viewer.businessId, id)
    const photos = [...(row.photos ?? [])]
    const subject = row.serialNumber
      ? `${row.item} (${row.serialNumber})`
      : row.item

    await row.deleteOne()
    void deleteUploads(photos, viewer.businessId)

    void logActivity({
      businessId: viewer.businessId,
      action: "maintenance_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject,
      targetKind: "maintenance",
      href: "/dashboard/maintenance",
    })

    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}

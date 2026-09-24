import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { ownParty } from "@/lib/money-refs"
import { connectToDatabase } from "@/lib/mongodb"
import { uploadsConfigured } from "@/lib/s3"
import { dayRangeInZone } from "@/lib/time"
import { maintenanceSchema } from "@/lib/validations/maintenance"
import { getWorkspace } from "@/lib/workspace"
import {
  MAINTENANCE_STATUSES,
  type MaintenanceStatus,
} from "@/lib/work-constants"
import { MaintenanceItem, toMaintenanceDTO } from "@/models/maintenance"

export const runtime = "nodejs"

/**
 * The repair bench.
 *
 * Owners and supervisors both: a supervisor runs the workshop, and an item
 * that came in this morning is no use to anyone if only the owner can write
 * it down.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)

    const filter: Record<string, unknown> = { business: viewer.businessId }
    const status = request.nextUrl.searchParams.get("status")
    if (status && MAINTENANCE_STATUSES.includes(status as MaintenanceStatus)) {
      filter.status = status
    }

    const rows = await MaintenanceItem.find(filter)
      .populate("assignee", "name")
      .sort({ receivedAt: -1, createdAt: -1 })
      .limit(500)

    return ok({
      items: rows.map((row) => toMaintenanceDTO(row, business.timeZone)),
      uploads: uploadsConfigured(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = maintenanceSchema.parse(await request.json())

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)
    const day = (key: string) => dayRangeInZone(key, business.timeZone).start

    const row = await MaintenanceItem.create({
      business: viewer.businessId,
      item: values.item,
      makeModel: values.makeModel,
      serialNumber: values.serialNumber,
      owner: values.owner,
      ownerRef: await ownParty(viewer.businessId, values.ownerId),
      fault: values.fault,
      diagnosis: values.diagnosis,
      status: values.status,
      receivedAt: day(values.receivedAt),
      dueAt: values.dueAt ? day(values.dueAt) : undefined,
      returnedAt: values.returnedAt ? day(values.returnedAt) : undefined,
      cost: values.cost,
      assignee: values.assigneeId,
      photos: values.photos,
      note: values.note,
      createdBy: viewer.id,
    })

    void logActivity({
      businessId: viewer.businessId,
      action: "maintenance_received",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: values.serialNumber
        ? `${values.item} (${values.serialNumber})`
        : values.item,
      detail: values.fault,
      targetKind: "maintenance",
      targetId: row._id,
      href: "/dashboard/maintenance",
    })

    await row.populate("assignee", "name")
    return ok({ item: toMaintenanceDTO(row, business.timeZone) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

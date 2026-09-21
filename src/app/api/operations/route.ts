import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { connectToDatabase } from "@/lib/mongodb"
import {
  OPERATION_POPULATE,
  describeOperation,
  hrefFor,
  scopedCustomer,
  scopedProject,
} from "@/lib/operations-server"
import { loadCrew } from "@/lib/tasks"
import { operationSchema } from "@/lib/validations/operations"
import { Operation, toOperationDTO } from "@/models/operation"
import {
  OPERATION_KINDS,
  type OperationKind,
  type OperationStatus,
} from "@/lib/work-constants"

export const runtime = "nodejs"

/**
 * One kind's list, or every kind at once when no `kind` is given — which is
 * what the calendar asks for. Owners and supervisors both; this is the work
 * they plan between them.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const params = request.nextUrl.searchParams
    const filter: Record<string, unknown> = { business: viewer.businessId }

    const kind = params.get("kind")
    if (kind && OPERATION_KINDS.includes(kind as OperationKind)) {
      filter.kind = kind
    }

    const status = params.get("status")
    if (status === "scheduled" || status === "done" || status === "cancelled") {
      filter.status = status as OperationStatus
    }

    // The calendar asks for a window; the lists ask for everything.
    const from = params.get("from")
    const to = params.get("to")
    if (from || to) {
      filter.startAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      }
    }

    const entries = await Operation.find(filter)
      .sort({ startAt: 1 })
      .limit(500)
      .populate(OPERATION_POPULATE)

    return ok({ operations: entries.map(toOperationDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = operationSchema.parse(await request.json())

    await connectToDatabase()

    // Everything referenced has to belong to this workspace — otherwise a
    // guessed id would reach into somebody else's.
    const [crew, customer, project] = await Promise.all([
      values.assigneeIds.length
        ? loadCrew(values.assigneeIds, viewer.businessId)
        : [],
      scopedCustomer(values.customerId, viewer.businessId),
      scopedProject(values.projectId, viewer.businessId),
    ])

    const entry = await Operation.create({
      business: viewer.businessId,
      kind: values.kind,
      title: values.title,
      details: values.details,
      startAt: new Date(values.startAt),
      endAt: values.endAt ? new Date(values.endAt) : undefined,
      allDay: values.allDay,
      status: values.status,
      priority: values.priority,
      assignees: crew.map((member) => member._id),
      customer: customer?._id,
      project: project?._id,
      location: values.location,
      completedAt: values.status === "done" ? new Date() : undefined,
      createdBy: viewer.id,
    })

    await entry.populate(OPERATION_POPULATE)

    await logActivity({
      businessId: viewer.businessId,
      action: "operation_created",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: values.title,
      detail: describeOperation(values.kind, values.startAt, values.location),
      targetKind: "operation",
      targetId: entry._id,
      href: hrefFor(values.kind),
    })

    return ok({ operation: toOperationDTO(entry) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

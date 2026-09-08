import type { NextRequest } from "next/server"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { notifySupervisors } from "@/lib/notify"
import { loadTaskForViewer } from "@/lib/tasks"
import { requestSchemaChecked } from "@/lib/validations/work"
import { REQUEST_STATUSES, WorkRequest, toRequestDTO } from "@/models/request"

export const runtime = "nodejs"

/** Employees see their own; owners and supervisors see the whole workspace. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const filter: Record<string, unknown> = { business: viewer.businessId }

    if (viewer.role === "employee") {
      filter.user = viewer.id
    }

    const status = request.nextUrl.searchParams.get("status")
    if (status && REQUEST_STATUSES.includes(status as never)) {
      filter.status = status
    }

    const requests = await WorkRequest.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .limit(200)
      .populate("user", "name")

    const all = requests.map(toRequestDTO)

    return ok({
      requests: all,
      counts: {
        pending: all.filter((r) => r.status === "pending").length,
        approved: all.filter((r) => r.status === "approved").length,
        rejected: all.filter((r) => r.status === "rejected").length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Raised by the crew. Owners approve rather than request. */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("employee", "supervisor")
    const values = requestSchemaChecked.parse(await request.json())

    await connectToDatabase()

    // A material request can name a task, but only one the viewer can see.
    let taskId: string | undefined
    if (values.kind === "material" && values.taskId) {
      const task = await loadTaskForViewer(values.taskId, viewer)
      taskId = String(task._id)
    }

    // One open request of a kind at a time keeps a double submit — or an
    // impatient employee — from filling the owner's queue with duplicates.
    const open = await WorkRequest.findOne({
      user: viewer.id,
      kind: values.kind,
      status: "pending",
    })

    if (open) {
      throw new HttpError(
        409,
        `You already have a ${values.kind} request waiting for a decision`
      )
    }

    const created = await WorkRequest.create({
      business: viewer.businessId,
      user: viewer.id,
      kind: values.kind,
      message: values.message,
      startDate: values.kind === "leave" ? values.startDate : undefined,
      endDate: values.kind === "leave" ? values.endDate : undefined,
      amount: values.kind === "advance" ? values.amount : undefined,
      task: taskId,
      status: "pending",
    })

    await created.populate("user", "name")

    await notifySupervisors({
      businessId: viewer.businessId,
      kind: "request_raised",
      title: `${viewer.name} raised a ${values.kind} request`,
      body: values.message,
      href: "/dashboard/approvals",
      actor: viewer.id,
    })

    return ok({ request: toRequestDTO(created) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

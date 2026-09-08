import type { HydratedDocument } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { notifyUser } from "@/lib/notify"
import { requestDecisionSchema } from "@/lib/validations/work"
import { Attendance } from "@/models/attendance"
import {
  WorkRequest,
  toRequestDTO,
  type RequestDocument,
} from "@/models/request"
import { User } from "@/models/user"

export const runtime = "nodejs"

/** Approve or reject. Only the owner decides. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/requests/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const values = requestDecisionSchema.parse(await request.json())

    await connectToDatabase()

    // The status guard is what makes a repeated click harmless: the second
    // one matches nothing, because the request is no longer pending.
    const decided = await WorkRequest.findOneAndUpdate(
      { _id: id, business: viewer.businessId, status: "pending" },
      {
        $set: {
          status: values.status,
          decidedBy: viewer.id,
          decidedAt: new Date(),
          decisionNote: values.decisionNote,
        },
      },
      { new: true }
    )

    if (!decided) {
      const exists = await WorkRequest.findOne({
        _id: id,
        business: viewer.businessId,
      })
      throw exists
        ? new HttpError(409, `That request was already ${exists.status}`)
        : new HttpError(404, "That request doesn't exist")
    }

    if (decided.status === "approved" && decided.kind === "leave") {
      await markLeaveDays(decided)
    }

    await decided.populate("user", "name")

    await notifyUser({
      businessId: viewer.businessId,
      userId: decided.user,
      kind: "request_decided",
      title: `Your ${decided.kind} request was ${values.status}`,
      body: values.decisionNote,
      href: "/dashboard/requests",
      actor: viewer.id,
    })

    return ok({ request: toRequestDTO(decided) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Approved leave writes the days out so they read as leave rather than as
 * absences on the employee's attendance screen.
 */
async function markLeaveDays(request: HydratedDocument<RequestDocument>) {
  if (!request.startDate || !request.endDate) return

  const employee = await User.findById(request.user).select("shift")
  const days = daysBetween(request.startDate, request.endDate)

  if (days.length === 0) return

  await Attendance.bulkWrite(
    days.map((day) => ({
      updateOne: {
        filter: { user: request.user, day },
        update: {
          $set: { status: "leave" },
          $setOnInsert: {
            business: request.business,
            user: request.user,
            day,
            shift: employee?.shift ?? null,
            lateByMin: 0,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  )
}

/** Inclusive "YYYY-MM-DD" range, capped so a typo can't write a decade. */
function daysBetween(start: string, end: string) {
  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return days

  while (cursor <= last && days.length < 366) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

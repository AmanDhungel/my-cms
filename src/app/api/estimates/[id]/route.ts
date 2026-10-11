import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import { totalsOf } from "@/lib/billing"
import { canDo, estimateState, type EstimateStatus } from "@/lib/estimates"
import { priceEstimateLines } from "@/lib/estimates-server"
import { connectToDatabase } from "@/lib/mongodb"
import { ownParty } from "@/lib/money-refs"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { estimateSchema } from "@/lib/validations/estimates"
import { getWorkspace } from "@/lib/workspace"
import { Estimate, toEstimateDTO } from "@/models/estimate"

export const runtime = "nodejs"

async function findOwn(businessId: string, id: string) {
  const estimate = await Estimate.findOne({ _id: id, business: businessId })
  if (!estimate) throw new HttpError(404, "That estimate doesn't exist")
  return estimate
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/estimates/[id]">) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    await connectToDatabase()
    const business = await getWorkspace(viewer)
    const estimate = await findOwn(viewer.businessId, id)
    return ok({
      estimate: toEstimateDTO(estimate, {
        timeZone: business.timeZone,
        today: dayKeyInZone(new Date(), business.timeZone),
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Edit one. Draft, Sent and Accepted can change; a converted estimate is a
 * record of what the sale was offered at, and is locked. Declined and
 * expired ones are reopened first (POST …/status).
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/estimates/[id]">) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = estimateSchema.parse(await readJson(request))
    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const estimate = await findOwn(viewer.businessId, id)
    const state = estimateState(
      estimate.status as EstimateStatus,
      dayKeyInZone(estimate.validUntil, business.timeZone),
      today
    )
    // An edit that moves the date forward is how an expired one comes back.
    const extending = state === "expired" && values.validUntil && values.validUntil >= today
    if (!canDo(state, "edit") && !extending) {
      throw new HttpError(
        409,
        state === "converted"
          ? "This estimate became a sale and can't change any more."
          : "Reopen this estimate before changing it."
      )
    }

    const lines = await priceEstimateLines(viewer.businessId, values.source, values.lines)
    const vatRate = values.withVat ? business.vatRate : 0
    estimate.source = values.source
    estimate.customer = {
      name: values.customer.name,
      phone: values.customer.phone,
      email: values.customer.email || undefined,
      address: values.customer.address,
      pan: values.customer.pan,
    }
    estimate.customerRef = await ownParty(viewer.businessId, values.customerId)
    estimate.set("lines", lines)
    estimate.vatRate = vatRate
    Object.assign(estimate, totalsOf(lines, vatRate))
    estimate.note = values.note
    if (values.validUntil) {
      estimate.validUntil = dayRangeInZone(values.validUntil, business.timeZone).start
    }
    if (values.send && (estimate.status === "draft")) {
      estimate.status = "sent"
      estimate.sentAt = new Date()
    }
    await estimate.save()

    return ok({ estimate: toEstimateDTO(estimate, { timeZone: business.timeZone, today }) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Only a draft can be deleted; anything that went out is declined instead. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/estimates/[id]">) {
  try {
    const viewer = await requireUser()
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params
    await connectToDatabase()
    const estimate = await findOwn(viewer.businessId, id)
    if (estimate.status !== "draft") {
      throw new HttpError(409, "Only a draft can be deleted. Mark this one declined instead.")
    }
    await estimate.deleteOne()
    void logActivity({
      businessId: viewer.businessId,
      action: "record_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: estimate.number,
      detail: "estimate",
    })
    return ok({ id })
  } catch (error) {
    return handleApiError(error)
  }
}

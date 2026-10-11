import type { NextRequest } from "next/server"

import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import {
  DEFAULT_VALIDITY_DAYS,
  addDays,
  canDo,
  estimateState,
  nextStatus,
  type EstimateStatus,
} from "@/lib/estimates"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { estimateActionSchema } from "@/lib/validations/estimates"
import { getWorkspace } from "@/lib/workspace"
import { Estimate, toEstimateDTO } from "@/models/estimate"

export const runtime = "nodejs"

/**
 * Mark sent, accepted or declined, or reopen a declined / expired one as a
 * draft. Reopening an expired estimate also moves its validity forward
 * (15 days from today unless a date is given) — otherwise it would still be
 * expired the moment it reopened.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/estimates/[id]/status">) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const { action, validUntil } = estimateActionSchema.parse(await readJson(request))
    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const estimate = await Estimate.findOne({ _id: id, business: viewer.businessId })
    if (!estimate) throw new HttpError(404, "That estimate doesn't exist")

    const until = dayKeyInZone(estimate.validUntil, business.timeZone)
    const state = estimateState(estimate.status as EstimateStatus, until, today)
    if (!canDo(state, action)) {
      throw new HttpError(409, `A ${state} estimate can't be marked that way.`)
    }

    estimate.status = nextStatus(action)
    if (action === "send") estimate.sentAt = new Date()
    if (action === "accept" || action === "decline") estimate.decidedAt = new Date()
    if (action === "reopen") {
      estimate.decidedAt = undefined
      const next = validUntil ?? (until < today ? addDays(today, DEFAULT_VALIDITY_DAYS) : until)
      estimate.validUntil = dayRangeInZone(next, business.timeZone).start
    }
    await estimate.save()

    return ok({ estimate: toEstimateDTO(estimate, { timeZone: business.timeZone, today }) })
  } catch (error) {
    return handleApiError(error)
  }
}

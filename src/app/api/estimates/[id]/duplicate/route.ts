import type { NextRequest } from "next/server"

import { handleApiError, HttpError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { DEFAULT_VALIDITY_DAYS, addDays } from "@/lib/estimates"
import { nextEstimateNumber } from "@/lib/estimates-server"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Estimate, toEstimateDTO } from "@/models/estimate"

export const runtime = "nodejs"

/** A fresh draft with the same party, lines and notes, a new number and dates. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/estimates/[id]/duplicate">) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    await connectToDatabase()
    const business = await getWorkspace(viewer)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const source = await Estimate.findOne({ _id: id, business: viewer.businessId })
    if (!source) throw new HttpError(404, "That estimate doesn't exist")

    const copy = await Estimate.create({
      business: viewer.businessId,
      number: await nextEstimateNumber(viewer.businessId),
      source: source.source,
      customer: source.customer,
      customerRef: source.customerRef,
      lines: source.lines,
      vatRate: source.vatRate,
      subtotal: source.subtotal,
      discountTotal: source.discountTotal,
      taxable: source.taxable,
      vatAmount: source.vatAmount,
      total: source.total,
      note: source.note,
      issuedOn: dayRangeInZone(today, business.timeZone).start,
      validUntil: dayRangeInZone(addDays(today, DEFAULT_VALIDITY_DAYS), business.timeZone).start,
      status: "draft",
      createdBy: viewer.id,
    })
    return ok({ estimate: toEstimateDTO(copy, { timeZone: business.timeZone, today }) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

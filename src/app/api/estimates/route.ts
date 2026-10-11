import { handleApiError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { totalsOf } from "@/lib/billing"
import { DEFAULT_VALIDITY_DAYS, addDays } from "@/lib/estimates"
import { nextEstimateNumber, priceEstimateLines } from "@/lib/estimates-server"
import { connectToDatabase } from "@/lib/mongodb"
import { ownParty } from "@/lib/money-refs"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { estimateSchema } from "@/lib/validations/estimates"
import { getWorkspace } from "@/lib/workspace"
import { Estimate, toEstimateDTO } from "@/models/estimate"

export const runtime = "nodejs"

/**
 * Sales estimates (quotations), newest first. Owners and supervisors, the
 * same people who raise bills. An estimate touches no stock, money or
 * balance until it is converted into a sale (models/estimate.ts).
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()
    const business = await getWorkspace(viewer)
    const context = {
      timeZone: business.timeZone,
      today: dayKeyInZone(new Date(), business.timeZone),
    }
    const estimates = await Estimate.find({ business: viewer.businessId })
      .sort({ createdAt: -1 })
      .limit(500)
    return ok({ estimates: estimates.map((one) => toEstimateDTO(one, context)) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = estimateSchema.parse(await readJson(request))
    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const customerRef = await ownParty(viewer.businessId, values.customerId)
    const lines = await priceEstimateLines(viewer.businessId, values.source, values.lines)
    const vatRate = values.withVat ? business.vatRate : 0
    const validUntil = values.validUntil ?? addDays(today, DEFAULT_VALIDITY_DAYS)

    const estimate = await Estimate.create({
      business: viewer.businessId,
      number: await nextEstimateNumber(viewer.businessId),
      source: values.source,
      customer: {
        name: values.customer.name,
        phone: values.customer.phone,
        email: values.customer.email || undefined,
        address: values.customer.address,
        pan: values.customer.pan,
      },
      customerRef,
      lines,
      vatRate,
      ...totalsOf(lines, vatRate),
      note: values.note,
      issuedOn: dayRangeInZone(today, business.timeZone).start,
      validUntil: dayRangeInZone(validUntil, business.timeZone).start,
      status: values.send ? "sent" : "draft",
      sentAt: values.send ? new Date() : undefined,
      createdBy: viewer.id,
    })

    return ok(
      { estimate: toEstimateDTO(estimate, { timeZone: business.timeZone, today }) },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}

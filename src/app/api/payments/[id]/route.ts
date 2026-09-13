import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Payment } from "@/models/payment"

export const runtime = "nodejs"

/**
 * Remove a payment that was entered by mistake. A bill it settled keeps the
 * state it was given — a bill is its own record, and flipping one back to
 * unpaid behind the owner's back would be worse than leaving it.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/payments/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params

    await connectToDatabase()

    const payment = await Payment.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!payment) throw new HttpError(404, "That payment doesn't exist")

    return ok({ id: String(payment._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

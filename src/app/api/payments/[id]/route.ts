import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import { connectToDatabase } from "@/lib/mongodb"
import { syncBillPayment } from "@/lib/payments"
import { Payment } from "@/models/payment"

export const runtime = "nodejs"

/**
 * Remove a payment that was entered by mistake. If it was one of a bill's
 * instalments the bill is re-totalled, so what is owed stays true rather
 * than reading settled on money that is no longer there.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/payments/[id]">
) {
  try {
    const viewer = await requireUser()
    // Deleting a record is the owner's alone (lib/auth/permissions.ts).
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params

    await connectToDatabase()

    const payment = await Payment.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!payment) throw new HttpError(404, "That payment doesn't exist")

    if (payment.bill) await syncBillPayment(payment.bill)

    // Audit trail: every delete is recorded (never any secret).
    void logActivity({
      businessId: viewer.businessId,
      action: "record_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: String(payment.amount ?? ""),
      detail: "payment",
    })
    return ok({ id: String(payment._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

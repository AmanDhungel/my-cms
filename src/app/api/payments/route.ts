import mongoose from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayRangeInZone } from "@/lib/time"
import { paymentSchema } from "@/lib/validations/payments"
import { getWorkspace } from "@/lib/workspace"
import { Bill } from "@/models/bill"
import { Payment, toPaymentDTO } from "@/models/payment"

export const runtime = "nodejs"

/**
 * The money that has actually changed hands, both ways. Owner only — a
 * supervisor runs the stock and the bills but doesn't see what the business
 * pays out.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)

    const payments = await Payment.find({ business: viewer.businessId })
      .populate("bill", "number")
      .sort({ paidOn: -1, createdAt: -1 })
      .limit(500)

    return ok({
      payments: payments.map((payment) =>
        toPaymentDTO(payment, business.timeZone)
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = paymentSchema.parse(await request.json())

    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    // Stored as the start of that day in the workspace's zone, so it reads
    // back as the date that was typed rather than the server's idea of it.
    const { start } = dayRangeInZone(values.paidOn, business.timeZone)

    if (values.billId) {
      const bill = await Bill.findOne({
        _id: values.billId,
        business: viewer.businessId,
      })

      if (!bill) throw new HttpError(404, "That bill doesn't exist")
      if (bill.status === "void") {
        throw new HttpError(409, `${bill.number} is void`)
      }
      // Accepting a quotation moves stock, which belongs on the bill itself.
      if (values.settleBill && bill.payment === "quotation") {
        throw new HttpError(
          409,
          `${bill.number} is still a quotation. Accept it on the bill first, so the stock moves with it.`
        )
      }
    }

    const doc = {
      business: viewer.businessId,
      direction: values.direction,
      party: values.party,
      amount: values.amount,
      method: values.method,
      reference: values.reference,
      note: values.note,
      paidOn: start,
      bill: values.billId,
      recordedBy: viewer.id,
    }

    // Settling writes two records, so they go together or not at all.
    if (values.settleBill && values.billId) {
      const session = await mongoose.startSession()
      let createdId: mongoose.Types.ObjectId | undefined

      try {
        await session.withTransaction(async () => {
          const settled = await Bill.findOneAndUpdate(
            {
              _id: values.billId,
              business: viewer.businessId,
              status: "issued",
            },
            { $set: { payment: "paid" }, $unset: { chequeNo: "" } },
            { new: true, session }
          )

          if (!settled) throw new HttpError(409, "That bill can't be settled")

          const [payment] = await Payment.create([doc], { session })
          createdId = payment._id
        })
      } finally {
        await session.endSession()
      }

      const payment = await Payment.findById(createdId)
        .populate("bill", "number")
        .orFail()

      return ok({ payment: toPaymentDTO(payment, business.timeZone) }, 201)
    }

    const payment = await Payment.create(doc)
    await payment.populate("bill", "number")

    return ok({ payment: toPaymentDTO(payment, business.timeZone) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

import mongoose from "mongoose"

import { handleApiError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import {
  allocationsFor,
  resolveAllocations,
  writeAllocations,
} from "@/lib/allocations-server"
import { connectToDatabase } from "@/lib/mongodb"
import { assertPayableBill, syncBillPayment } from "@/lib/payments"
import { toPaisa } from "@/lib/allocations"
import { assertPayablePurchase } from "@/lib/purchases-server"
import { dayRangeInZone } from "@/lib/time"
import { paymentSchema } from "@/lib/validations/payments"
import { getWorkspace } from "@/lib/workspace"
import { ownParty } from "@/lib/money-refs"
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

    const business = await getWorkspace(viewer)

    const payments = await Payment.find({ business: viewer.businessId })
      .populate("bill", "number")
      .sort({ paidOn: -1, createdAt: -1 })
      .limit(500)

    // Which accounts each one moved through, for an edit to start from.
    const allocations = await allocationsFor(
      viewer.businessId,
      payments.filter((payment) => payment.allocated).map((payment) => payment._id)
    )

    return ok({
      payments: payments.map((payment) =>
        toPaymentDTO(
          payment,
          business.timeZone,
          allocations.get(String(payment._id)) ?? []
        )
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = paymentSchema.parse(await readJson(request))

    await connectToDatabase()

    const business = await getWorkspace(viewer)
    // Stored as the start of that day in the workspace's zone, so it reads
    // back as the date that was typed rather than the server's idea of it.
    const { start } = dayRangeInZone(values.paidOn, business.timeZone)

    // Both references are checked against this workspace rather than trusted:
    // an id from a request is a claim until it is found here.
    const partyRef = await ownParty(viewer.businessId, values.partyId)
    // Cash names no account; anything else names one, or a split that adds
    // up (lib/allocations.ts). Checked before anything is written.
    const allocation = await resolveAllocations(viewer.businessId, {
      method: values.method,
      amount: values.amount,
      accountId: values.accountId,
      allocations: values.allocations,
      requireAccount: true,
    })

    if (values.billId) await assertPayableBill(viewer.businessId, values.billId)
    // Paying off a purchase made on credit: no more than is still owed on it.
    if (values.purchaseId) {
      await assertPayablePurchase(viewer.businessId, values.purchaseId, toPaisa(values.amount))
    }

    const doc = {
      business: viewer.businessId,
      direction: values.direction,
      party: values.party,
      partyRef,
      account: allocation.account,
      allocated: allocation.allocated || undefined,
      amount: values.amount,
      method: values.method,
      reference: values.reference,
      note: values.note,
      paidOn: start,
      bill: values.billId,
      purchase: values.purchaseId,
      recordedBy: viewer.id,
    }

    // The payment, the accounts it moved through and — for one against a
    // bill — the bill's own flag all land together or not at all: the
    // instalment lands, then the bill is settled if this one finished it off.
    const session = await mongoose.startSession()
    let createdId: mongoose.Types.ObjectId | undefined

    try {
      await session.withTransaction(async () => {
        const [payment] = await Payment.create([doc], { session })
        createdId = payment._id
        await writeAllocations(
          session,
          {
            businessId: viewer.businessId,
            paymentId: payment._id,
            direction: values.direction,
          },
          allocation.rows
        )
        if (values.billId) await syncBillPayment(values.billId, session)
      })
    } finally {
      await session.endSession()
    }

    const payment = await Payment.findById(createdId)
      .populate("bill", "number")
      .orFail()

    return ok(
      {
        payment: toPaymentDTO(
          payment,
          business.timeZone,
          allocation.rows.map((row) => ({
            accountId: String(row.account),
            amount: row.amount,
          }))
        ),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}

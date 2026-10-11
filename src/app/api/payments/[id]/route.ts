import mongoose from "mongoose"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertCanDeleteRecord } from "@/lib/auth/permissions"
import {
  removeAllocations,
  resolveAllocations,
  writeAllocations,
} from "@/lib/allocations-server"
import { connectToDatabase } from "@/lib/mongodb"
import { ownParty } from "@/lib/money-refs"
import { assertPayableBill, syncBillPayment } from "@/lib/payments"
import { toPaisa } from "@/lib/allocations"
import { assertPayablePurchase } from "@/lib/purchases-server"
import { dayRangeInZone } from "@/lib/time"
import { paymentSchema } from "@/lib/validations/payments"
import { getWorkspace } from "@/lib/workspace"
import { Payment, toPaymentDTO } from "@/models/payment"

export const runtime = "nodejs"

/**
 * Correct a payment. Owner only, like recording one.
 *
 * The accounts it moved through are replaced along with it — switching to
 * cash drops them, a new amount has to be split again — and a bill on either
 * side of the edit is re-totalled, all in one transaction. The cash row of an
 * expense is edited from the expense, which keeps the two in step.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/payments/[id]">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const values = paymentSchema.parse(await readJson(request))

    await connectToDatabase()

    const business = await getWorkspace(viewer)
    const payment = await Payment.findOne({ _id: id, business: viewer.businessId })
    if (!payment) throw new HttpError(404, "That payment doesn't exist")
    if (payment.expense) {
      throw new HttpError(
        409,
        "This is the cash side of an expense. Edit it from Expenses so the two stay in step."
      )
    }

    const { start } = dayRangeInZone(values.paidOn, business.timeZone)
    const partyRef = await ownParty(viewer.businessId, values.partyId)
    const allocation = await resolveAllocations(viewer.businessId, {
      method: values.method,
      amount: values.amount,
      accountId: values.accountId,
      allocations: values.allocations,
      requireAccount: true,
    })

    const previousBill = payment.bill ? String(payment.bill) : null
    const nextBill = values.direction === "in" ? (values.billId ?? null) : null
    if (nextBill && nextBill !== previousBill) {
      await assertPayableBill(viewer.businessId, nextBill)
    }
    const nextPurchase = values.direction === "out" ? (values.purchaseId ?? null) : null
    if (nextPurchase) {
      await assertPayablePurchase(viewer.businessId, nextPurchase, toPaisa(values.amount), payment._id)
    }

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        payment.direction = values.direction
        payment.party = values.party
        payment.partyRef = partyRef
        payment.account = allocation.account
        payment.allocated = allocation.allocated || undefined
        payment.amount = values.amount
        payment.method = values.method
        payment.reference = values.reference
        payment.note = values.note
        payment.paidOn = start
        payment.bill = nextBill ? new mongoose.Types.ObjectId(nextBill) : undefined
        payment.purchase = nextPurchase ? new mongoose.Types.ObjectId(nextPurchase) : undefined
        await payment.save({ session })

        await writeAllocations(
          session,
          {
            businessId: viewer.businessId,
            paymentId: payment._id,
            direction: values.direction,
          },
          allocation.rows
        )

        for (const bill of new Set([previousBill, nextBill])) {
          if (bill) await syncBillPayment(bill, session)
        }
      })
    } finally {
      await session.endSession()
    }

    await payment.populate("bill", "number")
    return ok({
      payment: toPaymentDTO(
        payment,
        business.timeZone,
        allocation.rows.map((row) => ({
          accountId: String(row.account),
          amount: row.amount,
        }))
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Remove a payment that was entered by mistake. If it was one of a bill's
 * instalments the bill is re-totalled, so what is owed stays true rather
 * than reading settled on money that is no longer there. Its account rows go
 * with it, which puts the money back on those accounts.
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

    const session = await mongoose.startSession()
    let deleted: Awaited<ReturnType<typeof Payment.findOneAndDelete>> = null

    try {
      await session.withTransaction(async () => {
        deleted = await Payment.findOneAndDelete(
          { _id: id, business: viewer.businessId },
          { session }
        )
        if (!deleted) return
        await removeAllocations(session, viewer.businessId, deleted._id)
        if (deleted.bill) await syncBillPayment(deleted.bill, session)
      })
    } finally {
      await session.endSession()
    }

    const payment = deleted as Awaited<ReturnType<typeof Payment.findOneAndDelete>>
    if (!payment) throw new HttpError(404, "That payment doesn't exist")

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

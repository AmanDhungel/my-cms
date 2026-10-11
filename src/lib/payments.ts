import { Types, type ClientSession } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { round2 } from "@/lib/billing"
import { Bill } from "@/models/bill"
import { Payment } from "@/models/payment"

/**
 * How much has actually been received against each bill, keyed by bill id.
 * Bills are paid in instalments as often as not, so what is owed is the total
 * less this — never a flag on the bill on its own.
 */
export async function paidByBill(businessId: string) {
  const rows = await Payment.aggregate<{ _id: unknown; paid: number }>([
    {
      $match: {
        business: new Types.ObjectId(businessId),
        direction: "in",
        bill: { $ne: null },
      },
    },
    { $group: { _id: "$bill", paid: { $sum: "$amount" } } },
  ])

  return new Map(rows.map((row) => [String(row._id), round2(row.paid)]))
}

/**
 * Brings a bill's paid/unpaid flag back in line with its ledger: settled once
 * the instalments cover it, owing again if one of them is deleted. Quotations
 * are left alone — accepting one is a decision, not an arithmetic result.
 */
export async function syncBillPayment(
  billId: Types.ObjectId | string,
  session?: ClientSession
) {
  const bill = await Bill.findById(billId).session(session ?? null)
  if (!bill || bill.status === "void" || bill.payment === "quotation") return

  const rows = await Payment.aggregate<{ paid: number }>([
    { $match: { bill: bill._id, direction: "in" } },
    { $group: { _id: null, paid: { $sum: "$amount" } } },
  ]).session(session ?? null)

  const paid = round2(rows[0]?.paid ?? 0)

  if (paid >= bill.total) {
    if (bill.payment !== "paid") {
      bill.payment = "paid"
      await bill.save({ session })
    }
    return
  }

  // Some of the money came back out from under it, so it is owed again.
  if (bill.payment === "paid" && paid > 0) {
    bill.payment = "unpaid"
    await bill.save({ session })
  }
}

/**
 * A bill a payment may be put against: this workspace's, not void, and no
 * longer a quotation (accepting one moves stock, which belongs on the bill).
 */
export async function assertPayableBill(businessId: string, billId: string) {
  const bill = await Bill.findOne({ _id: billId, business: businessId })

  if (!bill) throw new HttpError(404, "That bill doesn't exist")
  if (bill.status === "void") {
    throw new HttpError(409, `${bill.number} is void`)
  }
  if (bill.payment === "quotation") {
    throw new HttpError(
      409,
      `${bill.number} is still a quotation. Accept it on the bill first, so the stock moves with it.`
    )
  }
  return bill
}

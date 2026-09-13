import { Types, type ClientSession } from "mongoose"

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

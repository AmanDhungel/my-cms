import type { Types } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { toPaisa } from "@/lib/allocations"
import { Expense } from "@/models/expense"
import { Payment } from "@/models/payment"

/**
 * What has been paid against each purchase, in paisa: its own cash row
 * (paid at the time — absent on a purchase made wholly on credit) plus any
 * later payment that names it (`Payment.purchase`).
 */
export async function paidByPurchase(
  businessId: string,
  expenses: { _id: Types.ObjectId; payment?: Types.ObjectId | null }[]
): Promise<Map<string, number>> {
  return (await purchasePayments(businessId, expenses)).paid
}

/** Both halves: everything paid, and what was paid at the time (its own cash row). */
export async function purchasePayments(
  businessId: string,
  expenses: { _id: Types.ObjectId; payment?: Types.ObjectId | null }[]
): Promise<{ paid: Map<string, number>; atTime: Map<string, number> }> {
  const paid = new Map<string, number>()
  const atTime = new Map<string, number>()
  if (expenses.length === 0) return { paid, atTime }
  const mirrorIds = expenses.flatMap((one) => (one.payment ? [one.payment] : []))
  const [mirrors, later] = await Promise.all([
    Payment.find({ business: businessId, _id: { $in: mirrorIds } })
      .select("amount expense")
      .lean(),
    Payment.find({
      business: businessId,
      purchase: { $in: expenses.map((one) => one._id) },
    })
      .select("amount purchase")
      .lean(),
  ])
  for (const row of mirrors) {
    const key = String(row.expense)
    paid.set(key, (paid.get(key) ?? 0) + toPaisa(row.amount))
    atTime.set(key, (atTime.get(key) ?? 0) + toPaisa(row.amount))
  }
  for (const row of later) {
    const key = String(row.purchase)
    paid.set(key, (paid.get(key) ?? 0) + toPaisa(row.amount))
  }
  return { paid, atTime }
}

/**
 * A purchase a payment may be put against: this workspace's, with something
 * still owed on it, and no more than that. `except` leaves a payment being
 * edited out of what is already paid.
 */
export async function assertPayablePurchase(
  businessId: string,
  purchaseId: string,
  amountPaisa: number,
  except?: Types.ObjectId | string
) {
  const purchase = await Expense.findOne({ _id: purchaseId, business: businessId })
  if (!purchase) throw new HttpError(404, "That purchase doesn't exist")
  const paid = await paidByPurchase(businessId, [purchase])
  let already = paid.get(String(purchase._id)) ?? 0
  if (except) {
    const own = await Payment.findOne({ _id: except, purchase: purchase._id }).select("amount")
    if (own) already -= toPaisa(own.amount)
  }
  const owed = toPaisa(purchase.amount) - already
  if (amountPaisa > owed) {
    const message =
      owed <= 0
        ? "Nothing is owed on that purchase any more"
        : `Only ${(owed / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} is still owed on that purchase`
    throw new HttpError(422, message, { purchaseId: [message] })
  }
  return purchase
}

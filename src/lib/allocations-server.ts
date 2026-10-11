import type { ClientSession, Types } from "mongoose"

import { HttpError } from "@/lib/api-response"
import {
  fromPaisa,
  planAllocations,
  type AllocationInput,
} from "@/lib/allocations"
import { ownAccount } from "@/lib/money-refs"
import { PaymentAllocation } from "@/models/payment-allocation"
import type { PaymentDirection } from "@/lib/work-constants"

/**
 * The server half of lib/allocations.ts: every route that records money
 * goes through these, so a payment entered on the Payments page and the cash
 * row of an expense obey the same rules.
 *
 *   resolve…  checks the request (cash vs account, the split adds up, every
 *             account is this workspace's and still open) before anything
 *             is written;
 *   write… /  replace or remove a payment's rows, always inside the
 *   remove…   caller's transaction, so a failed save changes nothing.
 */

export type ResolvedAllocations = {
  rows: { account: Types.ObjectId; amount: number }[]
  /** For Payment.account / Expense.account: the one account, or none for a split or cash. */
  account: Types.ObjectId | undefined
  /** For Payment.allocated. */
  allocated: boolean
}

export async function resolveAllocations(
  businessId: string,
  input: {
    method: string
    amount: number
    accountId?: string
    allocations?: AllocationInput[]
    /** False for a supervisor, who can't see the accounts to pick one. */
    requireAccount: boolean
  }
): Promise<ResolvedAllocations> {
  const plan = planAllocations(input)
  if (!plan.ok) {
    throw new HttpError(422, plan.message, { [plan.path]: [plan.message] })
  }

  const rows: ResolvedAllocations["rows"] = []
  for (const [index, row] of plan.rows.entries()) {
    try {
      const account = await ownAccount(businessId, row.accountId)
      if (account) rows.push({ account, amount: fromPaisa(row.paisa) })
    } catch (error) {
      // Point the message at the field it came from.
      if (error instanceof HttpError) {
        const path = plan.rows.length > 1 || input.allocations?.length
          ? `allocations.${index}.accountId`
          : "accountId"
        throw new HttpError(error.status, error.message, { [path]: [error.message] })
      }
      throw error
    }
  }

  return {
    rows,
    account: rows.length === 1 ? rows[0].account : undefined,
    allocated: rows.length > 0,
  }
}

/** Replaces a payment's rows with `rows` (none, for cash). */
export async function writeAllocations(
  session: ClientSession,
  payment: { businessId: string; paymentId: Types.ObjectId | string; direction: PaymentDirection },
  rows: ResolvedAllocations["rows"]
) {
  await PaymentAllocation.deleteMany(
    { business: payment.businessId, payment: payment.paymentId },
    { session }
  )
  if (rows.length === 0) return
  await PaymentAllocation.create(
    rows.map((row) => ({
      business: payment.businessId,
      payment: payment.paymentId,
      account: row.account,
      direction: payment.direction,
      amount: row.amount,
    })),
    { session, ordered: true }
  )
}

/** Removes a payment's rows, with the payment, so its accounts get the money back. */
export async function removeAllocations(
  session: ClientSession,
  businessId: string,
  paymentId: Types.ObjectId | string
) {
  await PaymentAllocation.deleteMany(
    { business: businessId, payment: paymentId },
    { session }
  )
}

/** Each payment's rows, for the DTOs an edit form starts from. */
export async function allocationsFor(
  businessId: string,
  paymentIds: (Types.ObjectId | string)[]
): Promise<Map<string, { accountId: string; amount: number }[]>> {
  const map = new Map<string, { accountId: string; amount: number }[]>()
  if (paymentIds.length === 0) return map
  const rows = await PaymentAllocation.find({
    business: businessId,
    payment: { $in: paymentIds },
  })
    .select("payment account amount")
    .sort({ _id: 1 })
    .lean()
  for (const row of rows) {
    const key = String(row.payment)
    const list = map.get(key) ?? []
    list.push({ accountId: String(row.account), amount: row.amount })
    map.set(key, list)
  }
  return map
}

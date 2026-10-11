import type { NextRequest } from "next/server"
import { Types } from "mongoose"

import { handleApiError, HttpError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { fromPaisa, toPaisa } from "@/lib/allocations"
import {
  DAYBOOK_TYPES,
  daybookTotals,
  daybookType,
  sortDaybook,
  type DaybookType,
} from "@/lib/daybook"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Account } from "@/models/account"
import { Expense } from "@/models/expense"
import { Payment } from "@/models/payment"
import { PaymentAllocation } from "@/models/payment-allocation"

export const runtime = "nodejs"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The day book (lib/daybook.ts): every money movement in a range, newest
 * first, with Money in / Money out / Net. Owner only.
 *
 *   ?from=&to=        days, "YYYY-MM-DD" (default: today)
 *   ?accountId=       only what moved through that account (its share)
 *   ?type=            sale | payment_in | purchase | purchase_payment | expense | payment_out
 *   ?cashOnly=1       only cash — which moves no account, so this is cash in hand
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner")
    await connectToDatabase()
    const business = await getWorkspace(viewer)
    const zone = business.timeZone
    const params = request.nextUrl.searchParams
    const today = dayKeyInZone(new Date(), zone)
    const from = params.get("from") || today
    const to = params.get("to") || from
    if (!DAY.test(from) || !DAY.test(to)) throw new HttpError(422, "Pick a date", { from: ["Pick a date"] })
    const accountId = params.get("accountId")
    if (accountId && !Types.ObjectId.isValid(accountId)) throw new HttpError(404, "That account doesn't exist")
    const type = params.get("type")
    const wanted = (DAYBOOK_TYPES as readonly string[]).includes(type ?? "") ? (type as DaybookType) : null
    const cashOnly = params.get("cashOnly") === "1"

    const filter: Record<string, unknown> = {
      business: viewer.businessId,
      paidOn: {
        $gte: dayRangeInZone(from, zone).start,
        $lt: dayRangeInZone(to, zone).end,
      },
    }
    if (cashOnly) filter.method = "cash"
    const payments = await Payment.find(filter).sort({ paidOn: -1, createdAt: -1 }).limit(2000)

    // Each payment's accounts: its allocation rows, or (older ones) its account.
    const allocations = await PaymentAllocation.find({
      business: viewer.businessId,
      payment: { $in: payments.map((one) => one._id) },
    }).lean()
    const sharesOf = new Map<string, { account: string; paisa: number }[]>()
    for (const row of allocations) {
      const key = String(row.payment)
      sharesOf.set(key, [...(sharesOf.get(key) ?? []), { account: String(row.account), paisa: toPaisa(row.amount) }])
    }
    const accounts = new Map(
      (await Account.find({ business: viewer.businessId }).select("name")).map((one) => [String(one._id), one.name])
    )
    const expenseKinds = new Map(
      (
        await Expense.find({
          business: viewer.businessId,
          _id: { $in: payments.flatMap((one) => (one.expense ? [one.expense] : [])) },
        }).select("kind")
      ).map((one) => [String(one._id), one.kind])
    )

    const entries = payments.flatMap((payment) => {
      const id = String(payment._id)
      const shares = payment.allocated
        ? (sharesOf.get(id) ?? [])
        : payment.account
          ? [{ account: String(payment.account), paisa: toPaisa(payment.amount) }]
          : []
      const kind = daybookType({
        direction: payment.direction as "in" | "out",
        hasBill: Boolean(payment.bill),
        expenseKind: payment.expense ? (expenseKinds.get(String(payment.expense)) ?? "other") : null,
        settlesPurchase: Boolean(payment.purchase),
      })
      if (wanted && kind !== wanted) return []
      const paisa = accountId
        ? shares.filter((share) => share.account === accountId).reduce((sum, share) => sum + share.paisa, 0)
        : toPaisa(payment.amount)
      if (accountId && paisa === 0) return []
      return [
        {
          id,
          on: dayKeyInZone(payment.paidOn, zone),
          at: (payment.createdAt as Date).getTime(),
          type: kind,
          direction: payment.direction as "in" | "out",
          method: payment.method,
          paisa,
          party: payment.party,
          reference: payment.reference ?? null,
          note: payment.note ?? null,
          accounts: shares.map((share) => accounts.get(share.account) ?? "Account"),
          href: payment.bill ? `/dashboard/sales/${String(payment.bill)}` : "/dashboard/payments",
        },
      ]
    })

    const totals = daybookTotals(entries)
    return ok({
      from,
      to,
      today,
      entries: sortDaybook(entries).map(({ paisa, at, ...entry }) => ({ ...entry, amount: fromPaisa(paisa), at })),
      moneyIn: fromPaisa(totals.moneyIn),
      moneyOut: fromPaisa(totals.moneyOut),
      net: fromPaisa(totals.net),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

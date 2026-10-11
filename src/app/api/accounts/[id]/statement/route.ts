import type { NextRequest } from "next/server"

import { handleApiError, HttpError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { fromPaisa, maskAccountNumber, toPaisa } from "@/lib/allocations"
import { buildAccountStatement } from "@/lib/account-statement"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Account } from "@/models/account"
import { Payment } from "@/models/payment"
import { PaymentAllocation } from "@/models/payment-allocation"

export const runtime = "nodejs"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * One account's statement: its opening balance, every money in and out
 * through it with the balance after each, and the closing balance — the
 * same rows (PaymentAllocation, and older payments that name the account)
 * its balance on the Accounts tab is added up from. Owner only.
 *
 *   ?from=&to=   an optional period; before it rolls into the opening row
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/accounts/[id]/statement">) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const params = request.nextUrl.searchParams
    const from = params.get("from")
    const to = params.get("to")
    if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
      throw new HttpError(422, "Pick a date", { from: ["Pick a date"] })
    }
    await connectToDatabase()
    const business = await getWorkspace(viewer)
    const zone = business.timeZone
    const account = await Account.findOne({ _id: id, business: viewer.businessId })
    if (!account) throw new HttpError(404, "That account doesn't exist")

    const [allocations, legacy] = await Promise.all([
      PaymentAllocation.find({ business: viewer.businessId, account: account._id }).lean(),
      Payment.find({ business: viewer.businessId, account: account._id, allocated: { $ne: true } }),
    ])
    const allocatedPayments = await Payment.find({
      business: viewer.businessId,
      _id: { $in: allocations.map((row) => row.payment) },
    })
    const paymentById = new Map(allocatedPayments.map((one) => [String(one._id), one]))

    const movements = [
      ...allocations.flatMap((row) => {
        const payment = paymentById.get(String(row.payment))
        if (!payment) return []
        return [{ payment, paisa: toPaisa(row.amount), split: (payment.amount ?? 0) !== row.amount }]
      }),
      ...legacy.map((payment) => ({ payment, paisa: toPaisa(payment.amount), split: false })),
    ].map(({ payment, paisa, split }) => ({
      id: String(payment._id),
      on: dayKeyInZone(payment.paidOn, zone),
      at: (payment.createdAt as Date).getTime(),
      direction: payment.direction as "in" | "out",
      paisa,
      what: `${payment.direction === "in" ? "Money in" : "Money out"} — ${payment.party}`,
      detail: [payment.method, payment.reference, split ? "part of a split" : null].filter(Boolean).join(" · "),
      href: payment.bill ? `/dashboard/sales/${String(payment.bill)}` : "/dashboard/payments",
    }))

    const statement = buildAccountStatement(toPaisa(account.openingBalance ?? 0), movements, { from, to })
    return ok({
      account: {
        id: String(account._id),
        name: account.name,
        number: maskAccountNumber(account.reference),
        openingBalance: account.openingBalance ?? 0,
        openedOn: account.openedOn ? dayKeyInZone(account.openedOn, zone) : null,
        archived: Boolean(account.archivedAt),
      },
      today: dayKeyInZone(new Date(), zone),
      opening: fromPaisa(statement.opening),
      closing: fromPaisa(statement.closing),
      moneyIn: fromPaisa(statement.moneyIn),
      moneyOut: fromPaisa(statement.moneyOut),
      rows: statement.rows.map(({ paisa, running, at, ...row }) => ({
        ...row,
        amount: fromPaisa(paisa),
        running: fromPaisa(running),
        at,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

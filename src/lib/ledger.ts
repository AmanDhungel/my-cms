import mongoose from "mongoose"

import { round2 } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { Account, type AccountTotals } from "@/models/account"
import { Bill } from "@/models/bill"
import { Expense } from "@/models/expense"
import { Payment } from "@/models/payment"

/**
 * Running totals: what a party owes, and what an account holds.
 *
 * Both are derived on demand rather than stored. A balance kept as a column
 * is a number that has to be updated by every path that touches money, and
 * the first path that forgets leaves it quietly wrong for ever. Adding the
 * rows up costs a grouped query and can never disagree with them.
 */

const oid = (id: string) => new mongoose.Types.ObjectId(id)

/** Money that has moved through each account, keyed by account id. */
export async function accountTotals(
  businessId: string
): Promise<Map<string, AccountTotals>> {
  await connectToDatabase()
  const business = oid(businessId)

  /*
   * Only payments are counted, not expenses.
   *
   * Every expense mirrors itself onto the payments ledger as money out, so
   * counting both would take the same rupee off an account twice. Payments
   * are the cash record; expenses are what the cash was for.
   */
  const rows = await Payment.aggregate<{
    _id: { account: unknown; direction: string }
    total: number
    n: number
  }>([
    { $match: { business, account: { $ne: null } } },
    {
      $group: {
        _id: { account: "$account", direction: "$direction" },
        total: { $sum: "$amount" },
        n: { $sum: 1 },
      },
    },
  ])

  const totals = new Map<string, AccountTotals>()
  for (const row of rows) {
    const key = String(row._id.account)
    const at = totals.get(key) ?? { received: 0, paidOut: 0, movements: 0 }
    if (row._id.direction === "in") at.received += row.total
    else at.paidOut += row.total
    at.movements += row.n
    totals.set(key, at)
  }
  return totals
}

export async function loadAccounts(businessId: string) {
  await connectToDatabase()
  const [accounts, totals] = await Promise.all([
    Account.find({ business: businessId }).sort({
      archivedAt: 1,
      isDefault: -1,
      name: 1,
    }),
    accountTotals(businessId),
  ])
  return { accounts, totals }
}

// ---- a party's ledger -----------------------------------------------------

export type LedgerEntry = {
  id: string
  /** "YYYY-MM-DD" in the workspace's zone. */
  on: string
  kind: "bill" | "payment-in" | "payment-out" | "expense"
  reference: string
  detail: string | null
  /** What they owe us, added by a bill. */
  debit: number
  /** What clears it, added by a payment received. */
  credit: number
  href: string | null
}

export type PartyLedger = {
  entries: LedgerEntry[]
  /** Billed to them, in total. */
  billed: number
  /** Received from them. */
  received: number
  /** Paid out to them — a vendor's side of the relationship. */
  paidOut: number
  /**
   * What they still owe. Positive means they owe us; negative means we are
   * holding money of theirs, which happens with a deposit or an overpayment.
   */
  owed: number
  /** Running balance after each entry, in the same order. */
  running: number[]
}

/**
 * Everything that has passed between the workspace and one party.
 *
 * Bills, the money received against them, and anything paid out the other
 * way, in one list oldest first — which is the order a ledger is read in and
 * the only order a running balance makes sense in.
 *
 * Quotations are left out. A price offered is not a debt, and counting one
 * would tell a customer they owe for work nobody has agreed to yet.
 */
export async function partyLedger(
  businessId: string,
  partyId: string,
  zone: string,
  dayKey: (date: Date, zone: string) => string
): Promise<PartyLedger> {
  await connectToDatabase()
  const business = oid(businessId)
  const party = oid(partyId)

  const [bills, payments, expenses] = await Promise.all([
    Bill.find({
      business,
      customerRef: party,
      status: "issued",
      payment: { $ne: "quotation" },
    }).sort({ createdAt: 1 }),
    Payment.find({ business, partyRef: party }).sort({ paidOn: 1 }),
    Expense.find({ business, partyRef: party }).sort({ spentOn: 1 }),
  ])

  const entries: LedgerEntry[] = []

  for (const bill of bills) {
    entries.push({
      id: String(bill._id),
      on: dayKey(bill.createdAt as Date, zone),
      kind: "bill",
      reference: bill.number,
      detail: `${bill.lines.length} line${bill.lines.length === 1 ? "" : "s"}`,
      debit: round2(bill.total),
      credit: 0,
      href: `/dashboard/sales/${String(bill._id)}`,
    })
  }

  for (const payment of payments) {
    const isIn = payment.direction === "in"
    entries.push({
      id: String(payment._id),
      on: dayKey(payment.paidOn as Date, zone),
      kind: isIn ? "payment-in" : "payment-out",
      reference: payment.reference || (isIn ? "Payment in" : "Payment out"),
      detail: payment.note ?? payment.method,
      debit: isIn ? 0 : round2(payment.amount),
      credit: isIn ? round2(payment.amount) : 0,
      href: "/dashboard/payments",
    })
  }

  /*
   * Expenses are listed but never scored.
   *
   * Each one already mirrors itself onto the payments ledger, and that
   * mirrored row is in `payments` above. Giving the expense its own debit
   * would count the same money twice — so it appears for the reading of it,
   * with zeroes.
   */
  for (const expense of expenses) {
    entries.push({
      id: String(expense._id),
      on: dayKey(expense.spentOn as Date, zone),
      kind: "expense",
      reference: expense.reference || "Expense",
      detail: expense.note ?? expense.kind,
      debit: 0,
      credit: 0,
      href: "/dashboard/expenses",
    })
  }

  entries.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0))

  const running: number[] = []
  let balance = 0
  for (const entry of entries) {
    balance = round2(balance + entry.debit - entry.credit)
    running.push(balance)
  }

  return {
    entries,
    billed: round2(entries.reduce((n, e) => n + (e.kind === "bill" ? e.debit : 0), 0)),
    received: round2(entries.reduce((n, e) => n + e.credit, 0)),
    paidOut: round2(
      entries.reduce((n, e) => n + (e.kind === "payment-out" ? e.debit : 0), 0)
    ),
    owed: balance,
    running,
  }
}

import mongoose from "mongoose"

import { round2 } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { Account, type AccountTotals } from "@/models/account"
import { Bill } from "@/models/bill"
import { Expense } from "@/models/expense"
import { Payment } from "@/models/payment"
import { PaymentAllocation } from "@/models/payment-allocation"
import { Customer } from "@/models/customer"
import { fromPaisa, toPaisa } from "@/lib/allocations"
import { kindLabel } from "@/lib/expenses"
import { balanceOf, type KhataEvent } from "@/lib/khata"
import { dayKeyInZone } from "@/lib/time"

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
   *
   * Two kinds of payment row (lib/allocations.ts):
   *   - one recorded since allocations existed counts through its
   *     PaymentAllocation rows — one per account, or several for a split;
   *   - one from before counts, as it always did, against the single account
   *     it names. Nothing was backfilled, so these keep their balances.
   *
   * Summed as whole paisa, so a balance never picks up a floating-point
   * hair from adding rupee amounts.
   */
  const paisa = { $sum: { $round: [{ $multiply: ["$amount", 100] }, 0] } }
  type Row = { _id: { account: unknown; direction: string }; paisa: number; n: number }
  const group = {
    $group: {
      _id: { account: "$account", direction: "$direction" },
      paisa,
      n: { $sum: 1 },
    },
  }

  const [legacy, allocated] = await Promise.all([
    Payment.aggregate<Row>([
      { $match: { business, account: { $ne: null }, allocated: { $ne: true } } },
      group,
    ]),
    PaymentAllocation.aggregate<Row>([{ $match: { business } }, group]),
  ])

  const sums = new Map<string, { inPaisa: number; outPaisa: number; movements: number }>()
  for (const row of [...legacy, ...allocated]) {
    const key = String(row._id.account)
    const at = sums.get(key) ?? { inPaisa: 0, outPaisa: 0, movements: 0 }
    if (row._id.direction === "in") at.inPaisa += row.paisa
    else at.outPaisa += row.paisa
    at.movements += row.n
    sums.set(key, at)
  }

  const totals = new Map<string, AccountTotals>()
  for (const [key, at] of sums) {
    totals.set(key, {
      received: fromPaisa(at.inPaisa),
      paidOut: fromPaisa(at.outPaisa),
      movements: at.movements,
    })
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

// ---- the khata: one balance for every screen ------------------------------

/**
 * Every party's account events, for the whole workspace in one pass (see
 * lib/khata.ts for the rules and the signs). The Ledger tab, the Parties
 * list balance, the aging reports and the dashboard all read this, and
 * nothing else, for what a party owes.
 *
 * Which party a bill belongs to follows the Parties list exactly: the party
 * it was raised for, or — for a bill raised before that party was saved —
 * the party of the same name (the last of that name, by name order, as the
 * list resolves it). A payment against a bill belongs to the bill's party; a
 * purchase's cash row and later payments, to the purchase's party.
 *
 * The party page's older ledger (`partyLedger` above, and its endpoint) is
 * left exactly as it was, for anything that still reads it.
 */
export async function loadKhata(businessId: string, zone: string) {
  await connectToDatabase()
  const business = oid(businessId)

  const [parties, bills, payments, purchases] = await Promise.all([
    Customer.find({ business }).sort({ name: 1 }),
    Bill.find({ business }).select(
      "number customer customerRef total payment status lines createdAt dueDate"
    ),
    Payment.find({ business }).select(
      "direction amount method reference note partyRef bill expense purchase paidOn createdAt"
    ),
    Expense.find({ business, partyRef: { $ne: null } }).select(
      "kind payee partyRef amount reference note spentOn dueDate createdAt"
    ),
  ])

  const known = new Set(parties.map((party) => String(party._id)))
  const byName = new Map<string, string>()
  for (const party of parties) byName.set(party.name.toLowerCase(), String(party._id))

  const billParty = new Map<string, string>()
  for (const bill of bills) {
    const ref = bill.customerRef ? String(bill.customerRef) : null
    const party = ref && known.has(ref) ? ref : byName.get(bill.customer.name.toLowerCase())
    if (party) billParty.set(String(bill._id), party)
  }
  const purchaseParty = new Map<string, string>()
  for (const purchase of purchases) {
    const ref = String(purchase.partyRef)
    if (known.has(ref)) purchaseParty.set(String(purchase._id), ref)
  }

  const events = new Map<string, KhataEvent[]>()
  const add = (party: string | undefined | null, event: KhataEvent) => {
    if (!party || !known.has(party)) return
    const list = events.get(party) ?? []
    list.push(event)
    events.set(party, list)
  }
  const day = (date: Date) => dayKeyInZone(date, zone)
  const at = (date: unknown) => (date instanceof Date ? date.getTime() : 0)

  const live = new Set<string>()
  const receivedOn = new Map<string, number>()
  for (const payment of payments) {
    if (payment.direction === "in" && payment.bill) {
      const key = String(payment.bill)
      receivedOn.set(key, (receivedOn.get(key) ?? 0) + toPaisa(payment.amount))
    }
  }

  for (const bill of bills) {
    if (bill.status !== "issued" || bill.payment === "quotation") continue
    const id = String(bill._id)
    live.add(id)
    const party = billParty.get(id)
    const total = toPaisa(bill.total)
    const on = day(bill.createdAt as Date)
    add(party, {
      id,
      kind: "sale",
      on,
      what: `Sale ${bill.number}`,
      detail: `${bill.lines.length} item${bill.lines.length === 1 ? "" : "s"}`,
      billed: total,
      paid: 0,
      delta: total,
      href: `/dashboard/sales/${id}`,
      dueOn: bill.dueDate ? day(bill.dueDate) : on,
      at: at(bill.createdAt),
    })
    // Marked paid with no payment (or not enough) behind it: it has always
    // read as settled, so the rest is settled here too.
    const uncovered = total - (receivedOn.get(id) ?? 0)
    if (bill.payment === "paid" && uncovered > 0) {
      add(party, {
        id: `settled-${id}`,
        kind: "settled",
        on,
        what: `Marked paid at sale (${bill.number})`,
        detail: "No payment was recorded for it",
        billed: 0,
        paid: uncovered,
        delta: -uncovered,
        href: `/dashboard/sales/${id}`,
        appliesTo: id,
        at: at(bill.createdAt) + 1,
      })
    }
  }

  for (const purchase of purchases) {
    const id = String(purchase._id)
    const amount = toPaisa(purchase.amount)
    const on = day(purchase.spentOn)
    add(purchaseParty.get(id), {
      id,
      kind: "purchase",
      on,
      what: purchase.kind === "stock" ? "Purchase" : kindLabel(purchase.kind),
      detail: purchase.reference || purchase.note || null,
      billed: amount,
      paid: 0,
      delta: -amount,
      href: purchase.kind === "stock" ? "/dashboard/inventory" : "/dashboard/expenses",
      dueOn: purchase.dueDate ? day(purchase.dueDate) : on,
      at: at(purchase.createdAt),
    })
  }

  for (const payment of payments) {
    const id = String(payment._id)
    const amount = toPaisa(payment.amount)
    const on = day(payment.paidOn)
    const detail =
      [payment.reference, payment.note].filter(Boolean).join(" · ") || payment.method
    if (payment.direction === "in") {
      const bill = payment.bill ? String(payment.bill) : null
      add(bill ? (billParty.get(bill) ?? String(payment.partyRef ?? "")) : String(payment.partyRef ?? ""), {
        id,
        kind: "received",
        on,
        what: "Payment received",
        detail,
        billed: 0,
        paid: amount,
        delta: -amount,
        href: "/dashboard/payments",
        appliesTo: bill && live.has(bill) ? bill : undefined,
        at: at(payment.createdAt),
      })
    } else {
      const linked = payment.purchase
        ? String(payment.purchase)
        : payment.expense
          ? String(payment.expense)
          : null
      const party = linked && purchaseParty.has(linked)
        ? purchaseParty.get(linked)
        : String(payment.partyRef ?? "")
      add(party, {
        id,
        kind: "paid",
        on,
        what: payment.expense ? "Paid at purchase" : payment.purchase ? "Payment for a purchase" : "Payment made",
        detail,
        billed: 0,
        paid: amount,
        delta: amount,
        href: "/dashboard/payments",
        appliesTo: linked && purchaseParty.has(linked) ? linked : undefined,
        at: at(payment.createdAt) + (payment.expense ? 1 : 0),
      })
    }
  }

  return { parties, events }
}

/** Every party's balance, in paisa (+ they owe you, − you owe them). */
export async function khataBalances(businessId: string, zone: string) {
  const { parties, events } = await loadKhata(businessId, zone)
  return parties.map((party) => {
    const list = events.get(String(party._id)) ?? []
    return { party, events: list, balance: balanceOf(list) }
  })
}

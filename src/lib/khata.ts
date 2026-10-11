/**
 * A party's account with the business — the "khata" — in plain language.
 *
 * Every screen that says what a party owes reads this: the party's Ledger
 * tab, the balance on the Parties list, its To collect / To pay strip, the
 * Who owes you / Who you owe aging reports and the dashboard's totals. One
 * calculation, so the four can never disagree. (The loader that turns
 * bills, payments and purchases into these events is `loadKhata` in
 * ledger.ts.)
 *
 * The sign is the reader's: a positive balance means **they owe you**, a
 * negative one means **you owe them**. Nobody sees "debit" or "credit".
 *
 *   sale to them              +  (billed)   they owe you more
 *   money received from them  −  (paid)
 *   a sale marked paid at the till with no payment behind it
 *                             −  (paid)     "Settled at sale" — such a bill
 *                                           always read as settled, and still does
 *   purchase from them        −  (billed)   you owe them more
 *   money you paid them       +  (paid)
 *
 * All amounts are whole paisa. Dates are "YYYY-MM-DD" in the workspace's zone.
 * Pure: no database, no React, so it can be unit-tested directly.
 */

import { daysPastDue } from "@/lib/settlement"

export type KhataKind = "sale" | "received" | "settled" | "purchase" | "paid"

/** Which filter a row answers to on the Ledger tab. */
export type KhataType = "sales" | "purchases" | "payments"

export type KhataEvent = {
  id: string
  kind: KhataKind
  /** The day it happened. */
  on: string
  /** "Sale BILL-0012", "Payment received", "Purchase", … */
  what: string
  detail: string | null
  /** The amount billed on this row (a sale, or a purchase from them). */
  billed: number
  /** The amount paid on this row (by them, or by you). */
  paid: number
  /** Its effect on the balance: + they owe you more, − less. */
  delta: number
  /** Where clicking the row goes. */
  href: string | null
  /** A sale or purchase: when it falls due. */
  dueOn?: string
  /** A payment or settlement that belongs to one sale or purchase. */
  appliesTo?: string
  /** For ordering two events on the same day: when it was written. */
  at?: number
}

export const KIND_TYPE: Record<KhataKind, KhataType> = {
  sale: "sales",
  settled: "sales",
  purchase: "purchases",
  received: "payments",
  paid: "payments",
}

/** Oldest first; on one day, in the order they were written. */
export function sortEvents(events: readonly KhataEvent[]): KhataEvent[] {
  return [...events].sort((a, b) =>
    a.on !== b.on ? (a.on < b.on ? -1 : 1) : (a.at ?? 0) - (b.at ?? 0)
  )
}

export function balanceOf(events: readonly KhataEvent[]): number {
  return events.reduce((sum, event) => sum + event.delta, 0)
}

export type StatementRow = KhataEvent & { running: number }

export type Statement = {
  /** What stood before `from`: 0 for "All time". */
  opening: number
  closing: number
  /** The rows inside the period (and type filter), each with the balance after it. */
  rows: StatementRow[]
  /** Totals of the rows shown. */
  billed: number
  paid: number
}

/**
 * The statement for a period. The running balance is the true balance after
 * each row — it is worked out over every event, so filtering to "Payments"
 * hides rows but never changes a figure.
 */
export function buildStatement(
  events: readonly KhataEvent[],
  options: { from?: string | null; to?: string | null; types?: readonly KhataType[] } = {}
): Statement {
  const sorted = sortEvents(events)
  let balance = 0
  let opening = 0
  const rows: StatementRow[] = []
  for (const event of sorted) {
    balance += event.delta
    if (options.from && event.on < options.from) {
      opening = balance
      continue
    }
    if (options.to && event.on > options.to) continue
    if (options.types?.length && !options.types.includes(KIND_TYPE[event.kind])) continue
    rows.push({ ...event, running: balance })
  }
  const inPeriod = sorted.filter(
    (event) => (!options.from || event.on >= options.from) && (!options.to || event.on <= options.to)
  )
  return {
    opening,
    closing: opening + inPeriod.reduce((sum, event) => sum + event.delta, 0),
    rows,
    billed: rows.reduce((sum, row) => sum + row.billed, 0),
    paid: rows.reduce((sum, row) => sum + row.paid, 0),
  }
}

export type OpenItem = {
  id: string
  kind: KhataKind
  on: string
  dueOn: string
  what: string
  href: string | null
  /** The whole of it, and what is left once payments are matched against it. */
  amount: number
  remaining: number
}

/**
 * What is still open, item by item, once payments are matched to what they
 * pay for: a payment against a bill (or a purchase) first; then anything
 * paid "on account" against the oldest items left, first in first out.
 *
 * Every remaining item has the sign of the balance and they add up to it
 * exactly — which is what lets the aging report and the ledger agree.
 */
export function openItems(events: readonly KhataEvent[]): OpenItem[] {
  const sorted = sortEvents(events)
  type Item = OpenItem & { sign: 1 | -1 }
  const items: Item[] = sorted.map((event) => ({
    id: event.id,
    kind: event.kind,
    on: event.on,
    dueOn: event.dueOn ?? event.on,
    what: event.what,
    href: event.href,
    amount: Math.abs(event.delta),
    remaining: Math.abs(event.delta),
    sign: event.delta >= 0 ? 1 : -1,
  }))
  const byId = new Map(items.map((item) => [item.id, item]))

  // 1. Payments that name what they pay for.
  for (const [index, event] of sorted.entries()) {
    if (!event.appliesTo) continue
    const payment = items[index]
    const target = byId.get(event.appliesTo)
    if (!target || target.sign === payment.sign) continue
    const used = Math.min(target.remaining, payment.remaining)
    target.remaining -= used
    payment.remaining -= used
  }

  // 2. Everything else, oldest against oldest.
  const positives = items.filter((item) => item.sign === 1 && item.remaining > 0)
  const negatives = items.filter((item) => item.sign === -1 && item.remaining > 0)
  let p = 0
  let n = 0
  while (p < positives.length && n < negatives.length) {
    const used = Math.min(positives[p].remaining, negatives[n].remaining)
    positives[p].remaining -= used
    negatives[n].remaining -= used
    if (positives[p].remaining === 0) p++
    if (negatives[n].remaining === 0) n++
  }

  return items
    .filter((item) => item.remaining > 0)
    .map(({ sign, ...item }) => ({ ...item, remaining: sign * item.remaining }))
}

export const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Not yet due",
  d1_30: "1–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "Over 90 days",
}

/** Days past the due date → bucket. Day 0 (the due day itself) is not late. */
export function agingBucket(daysLate: number): AgingBucket {
  if (daysLate <= 0) return "current"
  if (daysLate <= 30) return "d1_30"
  if (daysLate <= 60) return "d31_60"
  if (daysLate <= 90) return "d61_90"
  return "d90_plus"
}

export type AgingRow = Record<AgingBucket, number> & { total: number; oldestDays: number }

/** One party's open items, by how late they are. Signs are dropped. */
export function agingOf(items: readonly OpenItem[], today: string): AgingRow {
  const row: AgingRow = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, oldestDays: 0 }
  for (const item of items) {
    const late = daysPastDue(item.dueOn, today)
    const amount = Math.abs(item.remaining)
    row[agingBucket(late)] += amount
    row.total += amount
    row.oldestDays = Math.max(row.oldestDays, late)
  }
  return row
}

export type BalanceTone = "owe_you" | "you_owe" | "settled"

/** The words and the colour for a balance. */
export function balanceTone(balance: number): BalanceTone {
  if (balance > 0) return "owe_you"
  if (balance < 0) return "you_owe"
  return "settled"
}

/** The To collect / To pay strip: positives and negatives summed apart. */
export function collectAndPay(balances: Iterable<number>) {
  let toCollect = 0
  let toPay = 0
  for (const balance of balances) {
    if (balance > 0) toCollect += balance
    else toPay -= balance
  }
  return { toCollect, toPay }
}

/**
 * Financial-year and month presets for the Ledger tab, as day keys.
 * The financial year starts on 16 July — the usual Gregorian date of
 * Shrawan 1 in Nepal (it can fall on the 17th); the app has no Bikram
 * Sambat calendar to be exact.
 */
export function periodPresets(today: string) {
  const [y, m] = today.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prevMonth = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  const fyStartYear = today >= `${y}-07-16` ? y : y - 1
  return {
    this_month: { from: `${y}-${pad(m)}-01`, to: today },
    last_month: {
      from: `${prevMonth.y}-${pad(prevMonth.m)}-01`,
      to: `${prevMonth.y}-${pad(prevMonth.m)}-${pad(lastDay(prevMonth.y, prevMonth.m))}`,
    },
    this_fy: { from: `${fyStartYear}-07-16`, to: today },
    all: { from: null, to: null },
  } as const
}

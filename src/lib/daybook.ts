/**
 * The day book: every movement of money for a day or a range, newest first,
 * with Money in / Money out / Net. Pure — the route feeds it payment rows.
 *
 * Every rupee that moves is a payment row: a sale paid at the till, the cash
 * side of an expense or purchase, a later payment against a purchase, or one
 * entered by hand. So the day book reads payments and nothing else, and a
 * sale "marked paid" with no payment behind it (a legacy bill) is not money
 * the book can show.
 */

export const DAYBOOK_TYPES = ["sale", "payment_in", "purchase", "purchase_payment", "expense", "payment_out"] as const
export type DaybookType = (typeof DAYBOOK_TYPES)[number]

export const DAYBOOK_LABELS: Record<DaybookType, string> = {
  sale: "Sale payment",
  payment_in: "Money in",
  purchase: "Purchase",
  purchase_payment: "Paid for a purchase",
  expense: "Expense",
  payment_out: "Money out",
}

export type DaybookSource = {
  direction: "in" | "out"
  hasBill: boolean
  /** Set when it is the cash side of an expense; `stock` marks a purchase. */
  expenseKind: string | null
  settlesPurchase: boolean
}

export function daybookType(source: DaybookSource): DaybookType {
  if (source.direction === "in") return source.hasBill ? "sale" : "payment_in"
  if (source.settlesPurchase) return "purchase_payment"
  if (source.expenseKind) return source.expenseKind === "stock" ? "purchase" : "expense"
  return "payment_out"
}

export type DaybookEntry = {
  id: string
  on: string
  at: number
  type: DaybookType
  direction: "in" | "out"
  method: string
  /** Whole paisa; with an account filter, only that account's share. */
  paisa: number
}

export function daybookTotals(entries: readonly { direction: "in" | "out"; paisa: number }[]) {
  let moneyIn = 0
  let moneyOut = 0
  for (const entry of entries) {
    if (entry.direction === "in") moneyIn += entry.paisa
    else moneyOut += entry.paisa
  }
  return { moneyIn, moneyOut, net: moneyIn - moneyOut }
}

/** Newest first; on one day, the latest written first. */
export function sortDaybook<T extends { on: string; at: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => (a.on !== b.on ? (a.on < b.on ? 1 : -1) : b.at - a.at))
}

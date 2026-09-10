/**
 * The arithmetic behind a bill, in one place so the totals the customer sees
 * while the bill is being typed are produced by exactly the code that writes
 * them to the database. Pure — no mongoose here, so the dialog can import it.
 */

import type { BillPayment } from "@/lib/work-constants"

/**
 * Whether a bill in this state has taken its lines off the shelf. A quotation
 * is a price offered, not a sale, so it holds no stock — accepting one is
 * what moves it, and turning a sale back into a quotation gives it back.
 */
export function holdsStock(payment: BillPayment) {
  return payment !== "quotation"
}

/** Money is kept to two places; floating point is not allowed to drift. */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export type PricedLine = {
  price: number
  qty: number
  /** Percent off this line. Groups of lines simply share a percentage. */
  discountPct: number
}

export type BillTotals = {
  subtotal: number
  discountTotal: number
  taxable: number
  vatAmount: number
  total: number
}

/**
 * Discounts come off the lines they were given to, then VAT is charged on
 * what is left — never on the money that was discounted away.
 */
export function totalsOf(lines: PricedLine[], vatRate: number): BillTotals {
  let subtotal = 0
  let discountTotal = 0

  for (const line of lines) {
    const gross = round2(line.price * line.qty)
    subtotal = round2(subtotal + gross)
    discountTotal = round2(discountTotal + (gross * line.discountPct) / 100)
  }

  const taxable = round2(subtotal - discountTotal)
  const vatAmount = round2((taxable * vatRate) / 100)

  return {
    subtotal,
    discountTotal,
    taxable,
    vatAmount,
    total: round2(taxable + vatAmount),
  }
}

/**
 * Two decimals, grouped. There is no currency on the workspace, so bills show
 * plain numbers the same way advance requests do.
 */
export function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Trims trailing zeroes for counts, where "2" reads better than "2.00". */
export function quantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 })
}

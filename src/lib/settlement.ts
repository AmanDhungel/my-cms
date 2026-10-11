/**
 * Where a sale (or a purchase on credit) stands: Paid, Partly paid, Unpaid
 * or Overdue — and how many days past its due date it is.
 *
 * Dates are "YYYY-MM-DD" day keys in the workspace's zone, so "overdue"
 * flips at the workspace's midnight, not the server's. Money is whole paisa.
 *
 * The due date is the one the bill was given, or — for a bill that has none,
 * which is every bill raised before due dates existed — the day it was
 * raised. Parties carry no credit terms in this app, so nothing is added to
 * that. The same rule feeds the status chip and the aging report, so the two
 * can never disagree about whether a bill is late.
 *
 * Pure: shared by the routes, the screens and the unit tests.
 */

export type SettleStatus = "paid" | "partly_paid" | "unpaid" | "overdue"

export const SETTLE_LABELS: Record<SettleStatus, string> = {
  paid: "Paid",
  partly_paid: "Partly paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
}

/** The day a record falls due: its own due date, else the day it was made. */
export function dueOn(record: { dueOn?: string | null; on: string }): string {
  return record.dueOn || record.on
}

/** Whole days from `due` to `today`; 0 on the day, negative before it. */
export function daysPastDue(due: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/**
 * The chip for one record. `due` is what is still owed on it (after any
 * "marked paid" flag), `paid` what has actually come in against it.
 */
export function settleStatus(input: {
  totalPaisa: number
  paidPaisa: number
  duePaisa: number
  dueOn: string
  today: string
}): SettleStatus {
  if (input.duePaisa <= 0) return "paid"
  if (daysPastDue(input.dueOn, input.today) > 0) return "overdue"
  return input.paidPaisa > 0 ? "partly_paid" : "unpaid"
}

/**
 * How much of a purchase is paid at the time it is recorded or edited, in
 * paisa.
 *
 * - `paidNow` sent: exactly that (the form's "Paid now").
 * - not sent, new record: all of it — how every expense was recorded before
 *   purchases on credit existed, and what an older client still means.
 * - not sent, an edit: a record that was paid in full stays paid in full at
 *   its new amount; one on credit keeps what was paid, never more than the
 *   new amount. An older client editing a credit purchase can't settle it by
 *   accident.
 */
export function purchasePaidPaisa(input: {
  amountPaisa: number
  paidNowPaisa?: number
  previous?: { amountPaisa: number; paidPaisa: number }
}): number {
  if (input.paidNowPaisa !== undefined) return input.paidNowPaisa
  if (!input.previous) return input.amountPaisa
  if (input.previous.paidPaisa >= input.previous.amountPaisa) return input.amountPaisa
  return Math.min(input.previous.paidPaisa, input.amountPaisa)
}

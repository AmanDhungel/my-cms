/**
 * Which accounts a payment moved through, and what that does to them.
 *
 * Cash moves through no account. Every other method names at least one: a
 * single account for the whole amount, or a split across several that adds
 * up to it exactly. The rows are PaymentAllocation documents; a payment
 * recorded before they existed has none and keeps counting against the one
 * account it names, so nothing needs a backfill.
 *
 * All arithmetic here is in whole paisa. Rupee amounts are converted once,
 * on the way in, and nothing is added up as a floating-point rupee figure —
 * 0.1 + 0.2 must never leave a split a hair short of its total.
 *
 * Pure, with no React or database import: the payment form, the server
 * helper (allocations-server.ts) and the unit tests share it.
 */

export type AllocationInput = { accountId: string; amount: number }

/** Whole paisa from a rupee amount, rounded to the nearest. */
export function toPaisa(rupees: number): number {
  if (!Number.isFinite(rupees)) return NaN
  return Math.round(rupees * 100)
}

/** Rupees from whole paisa; exact to two places. */
export function fromPaisa(paisa: number): number {
  return paisa / 100
}

/** Cash is the one method that moves through no account. */
export function needsAccount(method: string): boolean {
  return method !== "cash"
}

export type AllocationRow = { accountId: string; paisa: number }

export type AllocationPlan =
  | { ok: true; rows: AllocationRow[] }
  | { ok: false; path: string; message: string }

export const ACCOUNT_REQUIRED_MESSAGE = "Pick the account this went through"

/**
 * The allocation rows a payment should end up with, or why it can't.
 *
 * - cash: none, whatever was sent (an account picked before switching to
 *   cash is dropped, not refused).
 * - a split (`allocations` with at least one row): every row above zero, no
 *   account twice, and the rows adding up to the amount to the paisa.
 * - otherwise one row for the whole amount on `accountId`.
 * - neither, for a method that needs one: refused when `requireAccount`,
 *   else no rows (a supervisor, who cannot see accounts, records a stock
 *   purchase by bank transfer exactly as before).
 */
export function planAllocations(input: {
  method: string
  amount: number
  accountId?: string | null
  allocations?: readonly AllocationInput[] | null
  requireAccount?: boolean
}): AllocationPlan {
  if (!needsAccount(input.method)) return { ok: true, rows: [] }

  const total = toPaisa(input.amount)
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, path: "amount", message: "An amount has to be more than zero" }
  }

  const split = input.allocations ?? []
  if (split.length > 0) {
    const seen = new Set<string>()
    const rows: AllocationRow[] = []
    for (const [index, row] of split.entries()) {
      if (!row.accountId) {
        return { ok: false, path: `allocations.${index}.accountId`, message: "Pick an account" }
      }
      if (seen.has(row.accountId)) {
        return {
          ok: false,
          path: `allocations.${index}.accountId`,
          message: "That account is already in the split",
        }
      }
      seen.add(row.accountId)
      const paisa = toPaisa(row.amount)
      if (!Number.isFinite(paisa) || paisa <= 0) {
        return {
          ok: false,
          path: `allocations.${index}.amount`,
          message: "Each account needs an amount above zero",
        }
      }
      rows.push({ accountId: row.accountId, paisa })
    }
    const allocated = rows.reduce((sum, row) => sum + row.paisa, 0)
    if (allocated !== total) {
      return {
        ok: false,
        path: "allocations",
        message:
          allocated < total
            ? `The split is ${formatPaisa(total - allocated)} short of the amount`
            : `The split is ${formatPaisa(allocated - total)} more than the amount`,
      }
    }
    return { ok: true, rows }
  }

  if (input.accountId) {
    return { ok: true, rows: [{ accountId: input.accountId, paisa: total }] }
  }

  if (input.requireAccount) {
    return { ok: false, path: "accountId", message: ACCOUNT_REQUIRED_MESSAGE }
  }
  return { ok: true, rows: [] }
}

/** What a split adds up to, and what is left to place. */
export function splitProgress(amount: number, rows: readonly { amount: number | string }[]) {
  const total = toPaisa(amount) || 0
  const allocated = rows.reduce((sum, row) => {
    const paisa = toPaisa(Number(row.amount))
    return sum + (Number.isFinite(paisa) ? paisa : 0)
  }, 0)
  return { total, allocated, remaining: total - allocated }
}

/**
 * Where an account would stand after this payment, and whether to warn.
 *
 * Only money going out can run an account down. On an edit, the balance
 * already has this payment's previous allocation on that account taken off
 * (or added, for money in), so it is put back first — otherwise editing a
 * payment would warn about the very money it already spent.
 *
 * The warning is a heads-up, never a block: it shows when the account would
 * end below zero.
 */
export function projectBalance(input: {
  balancePaisa: number
  direction: "in" | "out"
  amountPaisa: number
  /** This payment's own allocation on the account before the edit, if any. */
  previous?: { direction: "in" | "out"; paisa: number } | null
}) {
  const undo = input.previous
    ? input.previous.direction === "out"
      ? input.previous.paisa
      : -input.previous.paisa
    : 0
  const before = input.balancePaisa + undo
  const after =
    input.direction === "out" ? before - input.amountPaisa : before + input.amountPaisa
  return {
    before,
    after,
    warn: input.direction === "out" && input.amountPaisa > 0 && after < 0,
  }
}

/** "1,234.50" from paisa — the same text money() in billing.ts gives. */
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? "-" : ""
  const abs = Math.abs(paisa)
  const rupees = Math.floor(abs / 100).toLocaleString("en-US")
  return `${sign}${rupees}.${String(abs % 100).padStart(2, "0")}`
}

/** "••••1234": enough to tell two accounts apart, not enough to copy. */
export function maskAccountNumber(reference: string | null | undefined): string | null {
  const value = (reference ?? "").replace(/\s+/g, "")
  if (!value) return null
  if (value.length <= 4) return `••••${value}`
  return `••••${value.slice(-4)}`
}

/** Allocations of one payment, summed per account (for the edit case). */
export function byAccount(rows: readonly AllocationRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) map.set(row.accountId, (map.get(row.accountId) ?? 0) + row.paisa)
  return map
}

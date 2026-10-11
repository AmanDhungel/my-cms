/**
 * An account's statement: opening balance, each money in and out in date
 * order with the balance after it, and the closing balance — in whole paisa.
 * Pure; the route feeds it the account's movements.
 */

export type AccountMovement = {
  id: string
  on: string
  /** For ordering two movements on one day. */
  at: number
  direction: "in" | "out"
  paisa: number
}

export function buildAccountStatement<T extends AccountMovement>(
  openingPaisa: number,
  movements: readonly T[],
  options: { from?: string | null; to?: string | null } = {}
) {
  const sorted = [...movements].sort((a, b) => (a.on !== b.on ? (a.on < b.on ? -1 : 1) : a.at - b.at))
  let balance = openingPaisa
  let opening = openingPaisa
  let moneyIn = 0
  let moneyOut = 0
  const rows: (T & { running: number })[] = []
  for (const movement of sorted) {
    balance += movement.direction === "in" ? movement.paisa : -movement.paisa
    if (options.from && movement.on < options.from) {
      opening = balance
      continue
    }
    if (options.to && movement.on > options.to) continue
    if (movement.direction === "in") moneyIn += movement.paisa
    else moneyOut += movement.paisa
    rows.push({ ...movement, running: balance })
  }
  return { opening, closing: opening + moneyIn - moneyOut, moneyIn, moneyOut, rows }
}

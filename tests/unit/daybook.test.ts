import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildAccountStatement } from "@/lib/account-statement"
import { daybookTotals, daybookType, sortDaybook } from "@/lib/daybook"

describe("day book", () => {
  it("names every kind of money movement", () => {
    const t = (over: Partial<Parameters<typeof daybookType>[0]>) =>
      daybookType({ direction: "in", hasBill: false, expenseKind: null, settlesPurchase: false, ...over })
    assert.equal(t({ hasBill: true }), "sale")
    assert.equal(t({}), "payment_in")
    assert.equal(t({ direction: "out", expenseKind: "stock" }), "purchase")
    assert.equal(t({ direction: "out", expenseKind: "rent" }), "expense")
    assert.equal(t({ direction: "out", settlesPurchase: true }), "purchase_payment")
    assert.equal(t({ direction: "out" }), "payment_out")
  })

  it("adds money in, money out and the net in paisa", () => {
    assert.deepEqual(
      daybookTotals([
        { direction: "in", paisa: 10 },
        { direction: "in", paisa: 20 },
        { direction: "out", paisa: 45 },
      ]),
      { moneyIn: 30, moneyOut: 45, net: -15 }
    )
  })

  it("lists newest first, latest written first within a day", () => {
    const rows = sortDaybook([
      { id: "a", on: "2026-10-10", at: 5 },
      { id: "b", on: "2026-10-11", at: 1 },
      { id: "c", on: "2026-10-11", at: 9 },
    ])
    assert.deepEqual(rows.map((row) => row.id), ["c", "b", "a"])
  })
})

describe("account statement", () => {
  const moves = [
    { id: "1", on: "2026-10-01", at: 1, direction: "in" as const, paisa: 50000 },
    { id: "2", on: "2026-10-05", at: 1, direction: "out" as const, paisa: 20010 },
    { id: "3", on: "2026-10-09", at: 1, direction: "in" as const, paisa: 10 },
  ]

  it("runs from the opening balance to the closing one", () => {
    const s = buildAccountStatement(100000, moves)
    assert.deepEqual(s.rows.map((row) => row.running), [150000, 129990, 130000])
    assert.equal(s.opening, 100000)
    assert.equal(s.closing, 130000)
    assert.equal(s.moneyIn, 50010)
    assert.equal(s.moneyOut, 20010)
  })

  it("rolls what came before the period into the opening row", () => {
    const s = buildAccountStatement(100000, moves, { from: "2026-10-05" })
    assert.equal(s.opening, 150000)
    assert.deepEqual(s.rows.map((row) => row.id), ["2", "3"])
    assert.equal(s.closing, 130000)
  })
})

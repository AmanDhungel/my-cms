import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  agingBucket,
  agingOf,
  balanceOf,
  balanceTone,
  buildStatement,
  collectAndPay,
  openItems,
  periodPresets,
  type KhataEvent,
} from "@/lib/khata"

let n = 0
const ev = (partial: Partial<KhataEvent> & Pick<KhataEvent, "kind" | "on" | "delta">): KhataEvent => ({
  id: partial.id ?? `e${++n}`,
  what: partial.kind,
  detail: null,
  billed: partial.kind === "sale" || partial.kind === "purchase" ? Math.abs(partial.delta) : 0,
  paid: partial.kind === "sale" || partial.kind === "purchase" ? 0 : Math.abs(partial.delta),
  href: null,
  ...partial,
})

// A customer: two sales, a part payment against the first, money on account.
const sale1 = ev({ id: "s1", kind: "sale", on: "2026-07-01", delta: 100000 })
const sale2 = ev({ id: "s2", kind: "sale", on: "2026-08-15", delta: 50050, dueOn: "2026-09-15" })
const paid1 = ev({ id: "p1", kind: "received", on: "2026-07-10", delta: -40000, appliesTo: "s1" })
const onAccount = ev({ id: "p2", kind: "received", on: "2026-09-01", delta: -20000 })
const customer = [sale2, onAccount, sale1, paid1] // deliberately out of order

describe("statement", () => {
  it("runs the balance in date order and closes on the total", () => {
    const s = buildStatement(customer)
    assert.deepEqual(s.rows.map((r) => r.id), ["s1", "p1", "s2", "p2"])
    assert.deepEqual(s.rows.map((r) => r.running), [100000, 60000, 110050, 90050])
    assert.equal(s.opening, 0)
    assert.equal(s.closing, 90050)
    assert.equal(s.closing, balanceOf(customer))
  })

  it("carries everything before the period into the opening row", () => {
    const s = buildStatement(customer, { from: "2026-08-01", to: "2026-08-31" })
    assert.equal(s.opening, 60000)
    assert.deepEqual(s.rows.map((r) => r.id), ["s2"])
    assert.equal(s.closing, 110050)
    assert.equal(s.rows[0].running, 110050)
  })

  it("includes the first and last day of the period", () => {
    const s = buildStatement(customer, { from: "2026-07-10", to: "2026-08-15" })
    assert.deepEqual(s.rows.map((r) => r.id), ["p1", "s2"])
  })

  it("hides rows by type without changing any balance", () => {
    const all = buildStatement(customer)
    const payments = buildStatement(customer, { types: ["payments"] })
    assert.deepEqual(payments.rows.map((r) => r.id), ["p1", "p2"])
    assert.deepEqual(payments.rows.map((r) => r.running), [60000, 90050])
    assert.equal(payments.closing, all.closing)
    assert.equal(payments.opening, all.opening)
  })

  it("orders same-day events by when they were written", () => {
    const a = ev({ id: "a", kind: "sale", on: "2026-01-01", delta: 500, at: 2 })
    const b = ev({ id: "b", kind: "received", on: "2026-01-01", delta: -500, at: 1 })
    assert.deepEqual(buildStatement([a, b]).rows.map((r) => r.id), ["b", "a"])
  })
})

describe("open items", () => {
  it("applies a linked payment to its own bill, the rest oldest first", () => {
    const open = openItems(customer)
    // s1: 1000 − 400 linked − 200 on account = 400 left; s2 untouched.
    assert.deepEqual(open.map((o) => [o.id, o.remaining]), [["s1", 40000], ["s2", 50050]])
    assert.equal(open.reduce((sum, o) => sum + o.remaining, 0), balanceOf(customer))
  })

  it("leaves credit open when they have paid more than they owe", () => {
    const events = [ev({ id: "s", kind: "sale", on: "2026-01-01", delta: 1000 }), ev({ id: "r", kind: "received", on: "2026-01-02", delta: -1500 })]
    assert.deepEqual(openItems(events).map((o) => [o.id, o.remaining]), [["r", -500]])
  })

  it("nets a purchase paid at the time to nothing", () => {
    const events = [
      ev({ id: "buy", kind: "purchase", on: "2026-01-01", delta: -27000 }),
      ev({ id: "cash", kind: "paid", on: "2026-01-01", delta: 27000, appliesTo: "buy" }),
    ]
    assert.equal(balanceOf(events), 0)
    assert.deepEqual(openItems(events), [])
  })

  it("keeps the unpaid part of a credit purchase open, with its due date", () => {
    const events = [
      ev({ id: "buy", kind: "purchase", on: "2026-01-01", delta: -100000, dueOn: "2026-02-01" }),
      ev({ id: "part", kind: "paid", on: "2026-01-01", delta: 30000, appliesTo: "buy" }),
    ]
    const open = openItems(events)
    assert.deepEqual(open.map((o) => [o.id, o.remaining, o.dueOn]), [["buy", -70000, "2026-02-01"]])
  })
})

describe("aging", () => {
  it("puts the bucket boundaries where they belong", () => {
    const cases: [number, string][] = [
      [-5, "current"], [0, "current"], [1, "d1_30"], [30, "d1_30"], [31, "d31_60"],
      [60, "d31_60"], [61, "d61_90"], [90, "d61_90"], [91, "d90_plus"], [400, "d90_plus"],
    ]
    for (const [days, bucket] of cases) assert.equal(agingBucket(days), bucket, `${days} days`)
  })

  it("ages a bill with no due date from the day it was raised", () => {
    const row = agingOf(openItems([ev({ id: "x", kind: "sale", on: "2026-09-01", delta: 1000 })]), "2026-10-11")
    assert.equal(row.d31_60, 1000) // 40 days
    assert.equal(row.oldestDays, 40)
  })

  it("ages by the due date when there is one", () => {
    const row = agingOf(openItems([ev({ id: "x", kind: "sale", on: "2026-09-01", delta: 1000, dueOn: "2026-10-11" })]), "2026-10-11")
    assert.equal(row.current, 1000)
  })
})

describe("reconciliation: ledger = parties list = aging = dashboard", () => {
  it("agrees in all four places for every party", () => {
    const parties: Record<string, KhataEvent[]> = {
      customer,
      vendor: [
        ev({ id: "v1", kind: "purchase", on: "2026-05-01", delta: -80000 }),
        ev({ id: "v2", kind: "paid", on: "2026-05-01", delta: 30000, appliesTo: "v1" }),
        ev({ id: "v3", kind: "purchase", on: "2026-09-20", delta: -12000 }),
      ],
      settled: [ev({ kind: "sale", on: "2026-01-01", delta: 500 }), ev({ kind: "settled", on: "2026-01-01", delta: -500 })],
    }
    const today = "2026-10-11"
    const balances: number[] = []
    for (const [name, events] of Object.entries(parties)) {
      const ledgerClosing = buildStatement(events).closing // Ledger tab
      const listBalance = balanceOf(events) // Parties list
      const aging = agingOf(openItems(events), today) // aging row (unsigned)
      assert.equal(ledgerClosing, listBalance, name)
      assert.equal(aging.total, Math.abs(listBalance), name)
      balances.push(listBalance)
    }
    const { toCollect, toPay } = collectAndPay(balances) // dashboard
    assert.equal(toCollect, 90050)
    assert.equal(toPay, 62000)
    assert.equal(balanceTone(0), "settled")
  })
})

describe("period presets", () => {
  it("knows the month, last month and the financial year (from 16 July)", () => {
    const p = periodPresets("2026-10-11")
    assert.deepEqual(p.this_month, { from: "2026-10-01", to: "2026-10-11" })
    assert.deepEqual(p.last_month, { from: "2026-09-01", to: "2026-09-30" })
    assert.deepEqual(p.this_fy, { from: "2026-07-16", to: "2026-10-11" })
    assert.deepEqual(periodPresets("2026-07-15").this_fy, { from: "2025-07-16", to: "2026-07-15" })
    assert.deepEqual(periodPresets("2026-01-20").last_month, { from: "2025-12-01", to: "2025-12-31" })
    assert.deepEqual(periodPresets("2028-03-05").last_month, { from: "2028-02-01", to: "2028-02-29" })
  })
})

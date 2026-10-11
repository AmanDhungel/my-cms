import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ACCOUNT_REQUIRED_MESSAGE,
  byAccount,
  formatPaisa,
  fromPaisa,
  maskAccountNumber,
  needsAccount,
  planAllocations,
  projectBalance,
  splitProgress,
  toPaisa,
  type AllocationRow,
} from "@/lib/allocations"

const A = "a".repeat(24)
const B = "b".repeat(24)
const C = "c".repeat(24)

/**
 * The balance rule the server applies (ledger.ts accountTotals): opening
 * plus money in, less money out, over an account's allocation rows — in paisa.
 */
function balance(openingPaisa: number, rows: { direction: "in" | "out"; paisa: number }[]) {
  return rows.reduce(
    (sum, row) => sum + (row.direction === "in" ? row.paisa : -row.paisa),
    openingPaisa
  )
}

describe("paisa arithmetic", () => {
  it("converts without floating-point drift", () => {
    assert.equal(toPaisa(0.1) + toPaisa(0.2), toPaisa(0.3))
    assert.equal(toPaisa(19.99), 1999)
    assert.equal(toPaisa(1234.5), 123450)
    assert.equal(fromPaisa(toPaisa(0.1) + toPaisa(0.2)), 0.3)
  })

  it("adds up a balance exactly", () => {
    // 1000.10 opening, +0.20 in, -0.30 out → 1000.00, not 999.9999999
    assert.equal(
      balance(toPaisa(1000.1), [
        { direction: "in", paisa: toPaisa(0.2) },
        { direction: "out", paisa: toPaisa(0.3) },
      ]),
      100000
    )
  })

  it("formats like money()", () => {
    assert.equal(formatPaisa(123450), "1,234.50")
    assert.equal(formatPaisa(-5), "-0.05")
    assert.equal(formatPaisa(0), "0.00")
  })
})

describe("cash and non-cash", () => {
  it("cash names no account, even if one was sent", () => {
    assert.equal(needsAccount("cash"), false)
    assert.deepEqual(
      planAllocations({ method: "cash", amount: 500, accountId: A, requireAccount: true }),
      { ok: true, rows: [] }
    )
    assert.deepEqual(
      planAllocations({
        method: "cash",
        amount: 500,
        allocations: [{ accountId: A, amount: 500 }],
        requireAccount: true,
      }),
      { ok: true, rows: [] }
    )
  })

  it("every other method needs an account", () => {
    for (const method of ["bank", "cheque", "online"]) {
      assert.equal(needsAccount(method), true)
      assert.deepEqual(planAllocations({ method, amount: 500, requireAccount: true }), {
        ok: false,
        path: "accountId",
        message: ACCOUNT_REQUIRED_MESSAGE,
      })
    }
  })

  it("lets a supervisor (no account access) record without one", () => {
    assert.deepEqual(planAllocations({ method: "bank", amount: 500, requireAccount: false }), {
      ok: true,
      rows: [],
    })
  })

  it("puts the whole amount on a single account", () => {
    assert.deepEqual(
      planAllocations({ method: "bank", amount: 1234.5, accountId: A, requireAccount: true }),
      { ok: true, rows: [{ accountId: A, paisa: 123450 }] }
    )
  })
})

describe("splits", () => {
  const split = (rows: { accountId: string; amount: number }[], amount = 1000) =>
    planAllocations({ method: "bank", amount, allocations: rows, requireAccount: true })

  it("accepts parts that add up exactly", () => {
    assert.deepEqual(split([{ accountId: A, amount: 600.1 }, { accountId: B, amount: 399.9 }]), {
      ok: true,
      rows: [
        { accountId: A, paisa: 60010 },
        { accountId: B, paisa: 39990 },
      ],
    })
  })

  it("accepts parts whose float sum would not be exact", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in paisa it is.
    assert.equal(split([{ accountId: A, amount: 0.1 }, { accountId: B, amount: 0.2 }], 0.3).ok, true)
  })

  it("refuses a split that is short or over", () => {
    const short = split([{ accountId: A, amount: 600 }, { accountId: B, amount: 399.99 }])
    assert.equal(short.ok, false)
    assert.equal(!short.ok && short.path, "allocations")
    assert.match(!short.ok ? short.message : "", /0\.01 short/)
    const over = split([{ accountId: A, amount: 600 }, { accountId: B, amount: 500 }])
    assert.match(!over.ok ? over.message : "", /100\.00 more/)
  })

  it("refuses a zero or negative part", () => {
    const zero = split([{ accountId: A, amount: 1000 }, { accountId: B, amount: 0 }])
    assert.equal(!zero.ok && zero.path, "allocations.1.amount")
    const negative = split([{ accountId: A, amount: 1100 }, { accountId: B, amount: -100 }])
    assert.equal(!negative.ok && negative.path, "allocations.1.amount")
  })

  it("refuses the same account twice", () => {
    const twice = split([{ accountId: A, amount: 500 }, { accountId: A, amount: 500 }])
    assert.equal(!twice.ok && twice.path, "allocations.1.accountId")
  })

  it("refuses a row with no account", () => {
    const blank = split([{ accountId: "", amount: 1000 }])
    assert.equal(!blank.ok && blank.path, "allocations.0.accountId")
  })

  it("accepts a one-row split for the whole amount", () => {
    assert.deepEqual(split([{ accountId: C, amount: 1000 }]), {
      ok: true,
      rows: [{ accountId: C, paisa: 100000 }],
    })
  })

  it("reports progress as the amount changes, keeping the rows", () => {
    const rows = [{ amount: "600" }, { amount: "300.5" }]
    assert.deepEqual(splitProgress(1000, rows), { total: 100000, allocated: 90050, remaining: 9950 })
    assert.deepEqual(splitProgress(900.5, rows), { total: 90050, allocated: 90050, remaining: 0 })
    assert.deepEqual(splitProgress(800, rows), { total: 80000, allocated: 90050, remaining: -10050 })
  })
})

describe("low-balance warning", () => {
  it("warns only when money out would take the account below zero", () => {
    const at = (balancePaisa: number, amountPaisa: number, direction: "in" | "out" = "out") =>
      projectBalance({ balancePaisa, amountPaisa, direction })
    assert.equal(at(50000, 40000).warn, false)
    assert.equal(at(50000, 50000).warn, false, "landing exactly on zero is fine")
    assert.equal(at(50000, 50001).warn, true, "one paisa past zero warns")
    assert.deepEqual(at(50000, 60000), { before: 50000, after: -10000, warn: true })
    assert.equal(at(-100, 100000, "in").warn, false, "money in never warns")
    assert.equal(at(0, 0).warn, false)
  })

  it("puts an edited payment's own money back before judging", () => {
    // Account had 1,000; this payment already took 800 off it → shows 200.
    // Editing the same payment to 900 leaves 100: no warning.
    const edit = projectBalance({
      balancePaisa: 20000,
      direction: "out",
      amountPaisa: 90000,
      previous: { direction: "out", paisa: 80000 },
    })
    assert.deepEqual(edit, { before: 100000, after: 10000, warn: false })
    // Without the exclusion it would have (wrongly) warned.
    assert.equal(projectBalance({ balancePaisa: 20000, direction: "out", amountPaisa: 90000 }).warn, true)
  })

  it("switches with the direction on an edit", () => {
    // Was 300 in (balance 300 includes it); now 500 out.
    const flipped = projectBalance({
      balancePaisa: 30000,
      direction: "out",
      amountPaisa: 50000,
      previous: { direction: "in", paisa: 30000 },
    })
    assert.deepEqual(flipped, { before: 0, after: -50000, warn: true })
  })
})

describe("edit and delete reversal", () => {
  /** An in-memory stand-in for the allocation rows, applied as the routes do. */
  function ledger(openingPaisa: number) {
    let rows = new Map<string, { direction: "in" | "out"; rows: AllocationRow[] }>()
    return {
      write(paymentId: string, direction: "in" | "out", plan: ReturnType<typeof planAllocations>) {
        assert.ok(plan.ok)
        if (plan.ok) rows.set(paymentId, { direction, rows: plan.rows })
      },
      remove(paymentId: string) {
        rows = new Map([...rows].filter(([id]) => id !== paymentId))
      },
      balanceOf(accountId: string) {
        return balance(
          openingPaisa,
          [...rows.values()].flatMap((payment) =>
            payment.rows
              .filter((row) => row.accountId === accountId)
              .map((row) => ({ direction: payment.direction, paisa: row.paisa }))
          )
        )
      },
    }
  }

  it("edit replaces, delete restores", () => {
    const book = ledger(100000)
    book.write("p1", "out", planAllocations({ method: "bank", amount: 300, accountId: A, requireAccount: true }))
    assert.equal(book.balanceOf(A), 70000)

    // Amount edited, then split across two accounts.
    book.write(
      "p1",
      "out",
      planAllocations({
        method: "bank",
        amount: 500,
        allocations: [
          { accountId: A, amount: 200 },
          { accountId: B, amount: 300 },
        ],
        requireAccount: true,
      })
    )
    assert.equal(book.balanceOf(A), 80000)
    assert.equal(book.balanceOf(B), 100000 - 30000)

    // Switched to cash: no account rows at all.
    book.write("p1", "out", planAllocations({ method: "cash", amount: 500, accountId: A, requireAccount: true }))
    assert.equal(book.balanceOf(A), 100000)
    assert.equal(book.balanceOf(B), 100000)

    book.write("p1", "out", planAllocations({ method: "bank", amount: 250, accountId: B, requireAccount: true }))
    book.remove("p1")
    assert.equal(book.balanceOf(B), 100000, "delete gives the money back")
  })

  it("sums one payment's rows per account", () => {
    assert.deepEqual(
      [...byAccount([{ accountId: A, paisa: 100 }, { accountId: B, paisa: 5 }, { accountId: A, paisa: 1 }])],
      [[A, 101], [B, 5]]
    )
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    assert.equal(maskAccountNumber("0123 4567 8901 1234"), "••••1234")
    assert.equal(maskAccountNumber("12"), "••••12")
    assert.equal(maskAccountNumber(""), null)
    assert.equal(maskAccountNumber(null), null)
  })
})

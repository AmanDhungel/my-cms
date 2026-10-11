import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { daysPastDue, dueOn, purchasePaidPaisa, settleStatus } from "@/lib/settlement"

const status = (total: number, paid: number, due: number, dueDay: string, today: string) =>
  settleStatus({ totalPaisa: total, paidPaisa: paid, duePaisa: due, dueOn: dueDay, today })

describe("payment status chip", () => {
  it("is Paid once nothing is due, however it got there", () => {
    assert.equal(status(1000, 1000, 0, "2026-01-01", "2026-12-31"), "paid")
    // Marked paid by hand, no money recorded: still settled.
    assert.equal(status(1000, 0, 0, "2026-01-01", "2026-12-31"), "paid")
  })

  it("is Unpaid or Partly paid until the due date, then Overdue", () => {
    assert.equal(status(1000, 0, 1000, "2026-10-20", "2026-10-11"), "unpaid")
    assert.equal(status(1000, 400, 600, "2026-10-20", "2026-10-11"), "partly_paid")
    assert.equal(status(1000, 400, 600, "2026-10-20", "2026-10-20"), "partly_paid", "on the due day it is not late yet")
    assert.equal(status(1000, 400, 600, "2026-10-20", "2026-10-21"), "overdue")
    assert.equal(status(1000, 0, 1000, "2026-10-20", "2026-10-21"), "overdue")
  })

  it("falls due the day it was raised when it has no due date", () => {
    assert.equal(dueOn({ on: "2026-10-01" }), "2026-10-01")
    assert.equal(dueOn({ on: "2026-10-01", dueOn: null }), "2026-10-01")
    assert.equal(dueOn({ on: "2026-10-01", dueOn: "2026-10-15" }), "2026-10-15")
  })

  it("counts days across month and year ends", () => {
    assert.equal(daysPastDue("2026-10-11", "2026-10-11"), 0)
    assert.equal(daysPastDue("2026-12-31", "2027-01-01"), 1)
    assert.equal(daysPastDue("2026-10-11", "2026-10-01"), -10)
    assert.equal(daysPastDue("2026-02-28", "2026-03-01"), 1)
  })
})

describe("paid now on a purchase", () => {
  it("is all of it when nothing says otherwise (how every expense was recorded)", () => {
    assert.equal(purchasePaidPaisa({ amountPaisa: 5000 }), 5000)
  })

  it("is what the form says", () => {
    assert.equal(purchasePaidPaisa({ amountPaisa: 5000, paidNowPaisa: 2000 }), 2000)
    assert.equal(purchasePaidPaisa({ amountPaisa: 5000, paidNowPaisa: 0 }), 0)
  })

  it("on an edit from an older client: paid in full stays paid in full at the new amount", () => {
    assert.equal(
      purchasePaidPaisa({ amountPaisa: 7000, previous: { amountPaisa: 5000, paidPaisa: 5000 } }),
      7000
    )
  })

  it("on an edit from an older client: a credit purchase keeps what was paid, never more than the amount", () => {
    assert.equal(
      purchasePaidPaisa({ amountPaisa: 7000, previous: { amountPaisa: 5000, paidPaisa: 2000 } }),
      2000
    )
    assert.equal(
      purchasePaidPaisa({ amountPaisa: 1500, previous: { amountPaisa: 5000, paidPaisa: 2000 } }),
      1500
    )
  })
})

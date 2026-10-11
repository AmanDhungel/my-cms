import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_VALIDITY_DAYS,
  addDays,
  allowedActions,
  canDo,
  estimateNumber,
  estimateState,
  nextStatus,
} from "@/lib/estimates"

describe("estimate status", () => {
  it("is Expired only while Draft or Sent and past its last valid day", () => {
    assert.equal(estimateState("draft", "2026-10-10", "2026-10-11"), "expired")
    assert.equal(estimateState("sent", "2026-10-10", "2026-10-11"), "expired")
    assert.equal(estimateState("sent", "2026-10-11", "2026-10-11"), "sent", "the last valid day itself is fine")
    assert.equal(estimateState("accepted", "2026-01-01", "2026-10-11"), "accepted")
    assert.equal(estimateState("converted", "2026-01-01", "2026-10-11"), "converted")
    assert.equal(estimateState("declined", "2026-01-01", "2026-10-11"), "declined")
  })

  it("stops being expired when the date is extended (nothing stored changes)", () => {
    assert.equal(estimateState("sent", "2026-10-10", "2026-10-11"), "expired")
    assert.equal(estimateState("sent", addDays("2026-10-11", DEFAULT_VALIDITY_DAYS), "2026-10-11"), "sent")
  })

  it("defaults to 15 days and adds across months", () => {
    assert.equal(DEFAULT_VALIDITY_DAYS, 15)
    assert.equal(addDays("2026-10-25", 15), "2026-11-09")
    assert.equal(addDays("2026-12-20", 15), "2027-01-04")
  })

  it("is locked once converted: no edit, no convert, no delete", () => {
    assert.deepEqual(allowedActions("converted"), ["duplicate"])
    assert.equal(canDo("converted", "edit"), false)
    assert.equal(canDo("converted", "convert"), false)
  })

  it("converts from Draft, Sent or Accepted; Declined and Expired reopen first", () => {
    for (const state of ["draft", "sent", "accepted"] as const) assert.equal(canDo(state, "convert"), true, state)
    for (const state of ["declined", "expired"] as const) {
      assert.equal(canDo(state, "convert"), false, state)
      assert.equal(canDo(state, "reopen"), true, state)
    }
  })

  it("only deletes a draft", () => {
    assert.equal(canDo("draft", "delete"), true)
    for (const state of ["sent", "accepted", "declined", "expired", "converted"] as const) {
      assert.equal(canDo(state, "delete"), false, state)
    }
  })

  it("maps actions to stored statuses and numbers sequentially", () => {
    assert.equal(nextStatus("send"), "sent")
    assert.equal(nextStatus("reopen"), "draft")
    assert.equal(estimateNumber(1), "EST-0001")
    assert.equal(estimateNumber(12345), "EST-12345")
  })
})

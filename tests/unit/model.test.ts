import assert from "node:assert/strict"
import { describe, it } from "node:test"
import mongoose, { Schema } from "mongoose"

import { defineModel } from "@/lib/model"

describe("defineModel (Part 1 root cause)", () => {
  it("reuses a model whose schema is current", () => {
    const first = defineModel("HarnessSame", new Schema({ a: String }))
    const again = defineModel("HarnessSame", new Schema({ a: String }))
    assert.equal(first, again)
  })

  it("replaces a model compiled before a field was added", () => {
    // What a long-running `next dev` held: the schema from before the change.
    mongoose.model("HarnessStale", new Schema({ name: String }))
    const current = defineModel<{ name: string; modulesConfiguredAt?: Date }>(
      "HarnessStale",
      new Schema({ name: String, modulesConfiguredAt: Date })
    )
    assert.ok(current.schema.path("modulesConfiguredAt"), "new field is known")
    // With the stale schema, strict mode would have dropped it from the write.
    const doc = new current({ name: "x", modulesConfiguredAt: new Date(0) })
    assert.equal(doc.modulesConfiguredAt?.getTime(), 0)
  })
})

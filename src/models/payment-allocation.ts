import {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { defineModel } from "@/lib/model"

import { PAYMENT_DIRECTIONS } from "@/lib/work-constants"

/**
 * One account's share of a payment (lib/allocations.ts).
 *
 * A non-cash payment has one row per account it moved through: one for the
 * whole amount, or several that add up to it. Cash has none, and so does
 * every payment recorded before these existed — those keep counting against
 * the single account on the payment itself, so nothing is backfilled.
 *
 * Rows are written and removed only together with their payment, in one
 * transaction (lib/allocations-server.ts). Deleting an account never touches
 * them: an account with any is archived instead.
 */
const paymentAllocationSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    /** The payment's own direction, copied so a balance is one $group away. */
    direction: { type: String, required: true, enum: PAYMENT_DIRECTIONS },
    /**
     * Rupees, to two places like every other amount in the app. Always
     * worked out from whole paisa, and summed back as paisa.
     */
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
)

// A payment's own rows: written, replaced and removed together.
paymentAllocationSchema.index({ payment: 1 })
// An account's movements, for its balance and the archive-or-delete check.
paymentAllocationSchema.index({ business: 1, account: 1 })

export type PaymentAllocationDocument = InferSchemaType<typeof paymentAllocationSchema>

export const PaymentAllocation: Model<PaymentAllocationDocument> =
  defineModel<PaymentAllocationDocument>("PaymentAllocation", paymentAllocationSchema)

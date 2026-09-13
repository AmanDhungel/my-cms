import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { dayKeyInZone } from "@/lib/time"
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_METHODS,
  type PaymentDirection,
  type PaymentMethod,
} from "@/lib/work-constants"

export {
  PAYMENT_DIRECTIONS,
  PAYMENT_METHODS,
  type PaymentDirection,
  type PaymentMethod,
}

/**
 * One movement of money in or out of the business: what you paid a supplier,
 * or what a customer paid you. Kept apart from a bill's own paid/unpaid state
 * — a bill is what was charged, this is what actually changed hands.
 */
const paymentSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    direction: { type: String, required: true, enum: PAYMENT_DIRECTIONS },
    /** The company or person on the other side, as typed. */
    party: { type: String, required: true, trim: true, maxlength: 140 },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      required: true,
      enum: PAYMENT_METHODS,
      default: "cash",
    },
    /** Cheque number, transaction id — whatever identifies it at the bank. */
    reference: { type: String, trim: true, maxlength: 60 },
    note: { type: String, trim: true, maxlength: 500 },
    /**
     * The day the money moved, stored as the start of that day in the
     * workspace's zone so it reads back as the same date it was entered as.
     */
    paidOn: { type: Date, required: true },
    /** Set when the payment was recorded against a bill. */
    bill: { type: Schema.Types.ObjectId, ref: "Bill" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

paymentSchema.index({ business: 1, paidOn: -1 })
paymentSchema.index({ business: 1, party: 1 })

export type PaymentDocument = InferSchemaType<typeof paymentSchema>

export const Payment: Model<PaymentDocument> =
  (models.Payment as Model<PaymentDocument>) ??
  model<PaymentDocument>("Payment", paymentSchema)

export type PaymentDTO = {
  id: string
  direction: PaymentDirection
  party: string
  amount: number
  method: PaymentMethod
  reference: string | null
  note: string | null
  /** "YYYY-MM-DD" in the workspace's zone, which is how it was entered. */
  paidOn: string
  bill: { id: string; number: string } | null
  createdAt: string
}

type MaybePopulated =
  | { _id: unknown; number?: string }
  | Schema.Types.ObjectId
  | null
  | undefined

/** The bill is a plain id unless the query populated it. */
function numbered(ref: MaybePopulated) {
  if (!ref) return null
  if (typeof ref === "object" && "number" in ref) {
    return { id: String(ref._id), number: ref.number ?? "" }
  }
  return { id: String(ref), number: "" }
}

export function toPaymentDTO(
  payment: HydratedDocument<PaymentDocument>,
  timeZone: string
): PaymentDTO {
  return {
    id: String(payment._id),
    direction: payment.direction as PaymentDirection,
    party: payment.party,
    amount: payment.amount,
    method: payment.method as PaymentMethod,
    reference: payment.reference ?? null,
    note: payment.note ?? null,
    paidOn: dayKeyInZone(payment.paidOn, timeZone),
    bill: numbered(payment.bill as MaybePopulated),
    createdAt: (payment.createdAt as Date).toISOString(),
  }
}

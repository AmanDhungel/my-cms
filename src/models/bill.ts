import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { round2 } from "@/lib/billing"
import {
  BILL_PAYMENTS,
  BILL_SOURCES,
  BILL_STATUSES,
  type BillPayment,
  type BillSource,
  type BillStatus,
} from "@/lib/work-constants"

export {
  BILL_PAYMENTS,
  BILL_SOURCES,
  BILL_STATUSES,
  type BillPayment,
  type BillSource,
  type BillStatus,
}

/**
 * One line of a bill. `item` is set when the line came from inventory, and
 * absent on a custom line typed by hand — that is the only difference between
 * the two kinds once the bill is written.
 *
 * `discountPct` sits on the line rather than in a separate list of discount
 * groups: a group is just "the lines carrying this percentage", so storing it
 * per line keeps the money unambiguous and still rebuilds the groups for the
 * editor.
 */
const lineSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "InventoryItem" },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    unit: { type: String, required: true, trim: true, default: "pcs" },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 0 },
    discountPct: { type: Number, required: true, min: 0, max: 100, default: 0 },
  },
  { _id: false }
)

/** Who the bill is for. A schema of its own so the type comes back required. */
const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 200 },
    /** The buyer's PAN, which a tax invoice names alongside the seller's. */
    pan: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false }
)

const billSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** Handed out by an atomic $inc on the workspace, e.g. BILL-0007. */
    number: { type: String, required: true, trim: true },
    source: { type: String, required: true, enum: BILL_SOURCES },
    customer: { type: customerSchema, required: true },
    lines: {
      type: [lineSchema],
      required: true,
      validate: {
        validator: (list: unknown[]) => list.length > 0,
        message: "A bill needs at least one line",
      },
    },
    /**
     * Snapshots of the rate and the arithmetic. A bill is a record of what was
     * charged, so it must never re-compute from today's settings.
     */
    vatRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    taxable: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    /** Settled, not settled, or handed over against a cheque. */
    payment: {
      type: String,
      required: true,
      enum: BILL_PAYMENTS,
      default: "unpaid",
    },
    /** Only kept while the bill is on cheque, for reconciling it later. */
    chequeNo: { type: String, trim: true, maxlength: 40 },
    note: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      enum: BILL_STATUSES,
      default: "issued",
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

billSchema.index({ business: 1, number: 1 }, { unique: true })
billSchema.index({ business: 1, createdAt: -1 })

export type BillDocument = InferSchemaType<typeof billSchema>

export const Bill: Model<BillDocument> =
  (models.Bill as Model<BillDocument>) ?? model<BillDocument>("Bill", billSchema)

export type BillLineDTO = {
  itemId: string | null
  name: string
  unit: string
  price: number
  qty: number
  discountPct: number
  /** price × qty, before its discount. */
  gross: number
  /** What the discount took off this line. */
  discount: number
  /** What the customer pays for this line, before VAT. */
  net: number
}

export type BillDTO = {
  id: string
  number: string
  source: BillSource
  customer: {
    name: string
    phone: string | null
    email: string | null
    address: string | null
    pan: string | null
  }
  lines: BillLineDTO[]
  vatRate: number
  subtotal: number
  discountTotal: number
  taxable: number
  vatAmount: number
  total: number
  note: string | null
  payment: BillPayment
  chequeNo: string | null
  status: BillStatus
  issuedBy: string
  createdAt: string
  voidedAt: string | null
}

export function toBillDTO(bill: HydratedDocument<BillDocument>): BillDTO {
  return {
    id: String(bill._id),
    number: bill.number,
    source: bill.source as BillSource,
    customer: {
      name: bill.customer.name,
      phone: bill.customer.phone ?? null,
      email: bill.customer.email ?? null,
      address: bill.customer.address ?? null,
      pan: bill.customer.pan ?? null,
    },
    lines: bill.lines.map((line) => {
      const gross = round2(line.price * line.qty)
      const discount = round2((gross * line.discountPct) / 100)
      return {
        itemId: line.item ? String(line.item) : null,
        name: line.name,
        unit: line.unit,
        price: line.price,
        qty: line.qty,
        discountPct: line.discountPct,
        gross,
        discount,
        net: round2(gross - discount),
      }
    }),
    vatRate: bill.vatRate,
    subtotal: bill.subtotal,
    discountTotal: bill.discountTotal,
    taxable: bill.taxable,
    vatAmount: bill.vatAmount,
    total: bill.total,
    note: bill.note ?? null,
    payment: bill.payment as BillPayment,
    chequeNo: bill.chequeNo ?? null,
    status: bill.status as BillStatus,
    issuedBy: String(bill.issuedBy),
    createdAt: (bill.createdAt as Date).toISOString(),
    voidedAt: bill.voidedAt ? bill.voidedAt.toISOString() : null,
  }
}

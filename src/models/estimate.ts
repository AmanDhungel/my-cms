import {
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { round2 } from "@/lib/billing"
import {
  ESTIMATE_STATUSES,
  estimateState,
  type EstimateState,
  type EstimateStatus,
} from "@/lib/estimates"
import { defineModel } from "@/lib/model"
import { dayKeyInZone } from "@/lib/time"
import { BILL_SOURCES, type BillSource } from "@/lib/work-constants"

/**
 * A sales estimate (quotation): a priced offer to a party, numbered EST-0001
 * per workspace (lib/estimates.ts).
 *
 * It is kept entirely apart from bills, so it moves no stock, no money and no
 * balance, and no report or dashboard total sees it — until it is converted,
 * when the sale it becomes does all of that and the two point at each other
 * (`saleRef` here, `estimateRef` on the bill).
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

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 200 },
    pan: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false }
)

const estimateSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** Handed out by an atomic $inc on the workspace's estimateSeq. */
    number: { type: String, required: true, trim: true },
    /** Inventory lines carry an item; custom lines are typed by hand. */
    source: { type: String, required: true, enum: BILL_SOURCES },
    customer: { type: customerSchema, required: true },
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer" },
    lines: {
      type: [lineSchema],
      required: true,
      validate: {
        validator: (list: unknown[]) => list.length > 0,
        message: "An estimate needs at least one line",
      },
    },
    vatRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    taxable: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    /** Notes and terms, printed on it. */
    note: { type: String, trim: true, maxlength: 1000 },
    /** The estimate's day, and its last valid day (start of day, workspace zone). */
    issuedOn: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    /** Stored status; "expired" is derived (lib/estimates.ts). */
    status: { type: String, required: true, enum: ESTIMATE_STATUSES, default: "draft" },
    sentAt: { type: Date },
    decidedAt: { type: Date },
    /** The sale it became. Set once, in the same transaction as the sale. */
    saleRef: { type: Schema.Types.ObjectId, ref: "Bill" },
    convertedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

estimateSchema.index({ business: 1, number: 1 }, { unique: true })
estimateSchema.index({ business: 1, createdAt: -1 })

export type EstimateDocument = InferSchemaType<typeof estimateSchema>

/** Once per process, and never with a stale schema (lib/model.ts). */
export const Estimate: Model<EstimateDocument> = defineModel<EstimateDocument>(
  "Estimate",
  estimateSchema
)

export type EstimateLineDTO = {
  itemId: string | null
  name: string
  unit: string
  price: number
  qty: number
  discountPct: number
  /** price × qty less its discount, before VAT. */
  net: number
}

export type EstimateDTO = {
  id: string
  number: string
  source: BillSource
  customerId: string | null
  customer: { name: string; phone: string | null; email: string | null; address: string | null; pan: string | null }
  lines: EstimateLineDTO[]
  vatRate: number
  subtotal: number
  discountTotal: number
  taxable: number
  vatAmount: number
  total: number
  note: string | null
  /** "YYYY-MM-DD" in the workspace's zone. */
  issuedOn: string
  validUntil: string
  status: EstimateStatus
  /** What a reader sees: the status, or "expired". */
  state: EstimateState
  saleId: string | null
  createdAt: string
}

export function toEstimateDTO(
  estimate: HydratedDocument<EstimateDocument>,
  context: { timeZone: string; today: string }
): EstimateDTO {
  const validUntil = dayKeyInZone(estimate.validUntil, context.timeZone)
  const status = estimate.status as EstimateStatus
  return {
    id: String(estimate._id),
    number: estimate.number,
    source: estimate.source as BillSource,
    customerId: estimate.customerRef ? String(estimate.customerRef) : null,
    customer: {
      name: estimate.customer.name,
      phone: estimate.customer.phone ?? null,
      email: estimate.customer.email ?? null,
      address: estimate.customer.address ?? null,
      pan: estimate.customer.pan ?? null,
    },
    lines: estimate.lines.map((line) => {
      const gross = round2(line.price * line.qty)
      return {
        itemId: line.item ? String(line.item) : null,
        name: line.name,
        unit: line.unit,
        price: line.price,
        qty: line.qty,
        discountPct: line.discountPct,
        net: round2(gross - (gross * line.discountPct) / 100),
      }
    }),
    vatRate: estimate.vatRate,
    subtotal: estimate.subtotal,
    discountTotal: estimate.discountTotal,
    taxable: estimate.taxable,
    vatAmount: estimate.vatAmount,
    total: estimate.total,
    note: estimate.note ?? null,
    issuedOn: dayKeyInZone(estimate.issuedOn, context.timeZone),
    validUntil,
    status,
    state: estimateState(status, validUntil, context.today),
    saleId: estimate.saleRef ? String(estimate.saleRef) : null,
    createdAt: (estimate.createdAt as Date).toISOString(),
  }
}

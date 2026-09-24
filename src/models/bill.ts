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
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/work-constants"

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
    /**
     * What the goods cost us, copied off the item as the bill was raised.
     *
     * Snapshotted rather than looked up later because the cost of a thing
     * changes with every purchase: asking today what a cable cost would price
     * last year's sale at this year's figure. Absent on bills raised before
     * purchases were recorded, and on custom lines that were never stock.
     */
    cost: { type: Number, min: 0 },
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

/**
 * One thing the client said.
 *
 * A remark can point at a line — "this cable price isn't justified" — or at
 * the quotation as a whole. Both sides can write, so the thread reads as a
 * conversation rather than a one-way complaint.
 */
const remarkSchema = new Schema(
  {
    /** Which line it is about. Null means the quotation generally. */
    lineIndex: { type: Number, min: 0 },
    text: { type: String, required: true, trim: true, maxlength: 1500 },
    /** "client" or the name of whoever answered from this side. */
    author: { type: String, required: true, trim: true, maxlength: 140 },
    fromClient: { type: Boolean, required: true, default: true },
    at: { type: Date, required: true },
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
    /**
     * The customer record this was raised for, when one was picked. The
     * embedded copy above is what prints; this is what lets a customer's
     * whole history be added up.
     */
    customerRef: { type: Schema.Types.ObjectId, ref: "Customer" },
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
    /**
     * The client's own view of this quotation.
     *
     * Present only once it has been shared. The token is the whole of the
     * client's credential — long, random and revocable — because asking
     * somebody to make an account to look at one price list is how a
     * quotation goes unanswered.
     */
    review: {
      token: { type: String, trim: true, maxlength: 64 },
      /** The email address or phone number it was sent to. */
      invitedTo: { type: String, trim: true, maxlength: 160 },
      invitedAt: { type: Date },
      expiresAt: { type: Date },
      revokedAt: { type: Date },
      status: {
        type: String,
        enum: REVIEW_STATUSES,
        default: "pending",
      },
      decidedAt: { type: Date },
      /** Who they said they were when they answered. */
      clientName: { type: String, trim: true, maxlength: 140 },
      remarks: { type: [remarkSchema], default: [] },
    },

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

// The token is the only way a client's request finds its quotation.
billSchema.index({ "review.token": 1 }, { sparse: true })
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

export type BillReviewDTO = {
  status: ReviewStatus
  invitedTo: string | null
  invitedAt: string | null
  expiresAt: string | null
  revoked: boolean
  decidedAt: string | null
  clientName: string | null
  remarks: {
    lineIndex: number | null
    text: string
    author: string
    fromClient: boolean
    at: string
  }[]
  /** Never leaves the workspace: the owner needs it to build the link. */
  token: string | null
}

export type BillDTO = {
  review: BillReviewDTO | null
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
  customerId: string | null
  lines: BillLineDTO[]
  vatRate: number
  subtotal: number
  discountTotal: number
  taxable: number
  vatAmount: number
  total: number
  note: string | null
  /** Money actually received against it, from the payments ledger. */
  paid: number
  /** What is still owed. Zero on a quotation, which owes nothing yet. */
  due: number
  payment: BillPayment
  chequeNo: string | null
  status: BillStatus
  issuedBy: string
  createdAt: string
  voidedAt: string | null
}

export function toBillDTO(
  bill: HydratedDocument<BillDocument>,
  /** Summed from the payments pointing at this bill. */
  paid = 0
): BillDTO {
  return {
    review: toReviewDTO(bill),
    id: String(bill._id),
    number: bill.number,
    source: bill.source as BillSource,
    customerId: bill.customerRef ? String(bill.customerRef) : null,
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
    paid: round2(paid),
    /**
     * Nothing is owed on a quotation, on a void bill, or on one the owner has
     * marked paid — that flag is their word for it, whether or not the money
     * went through the ledger. Everything else owes its total less what has
     * actually come in, which is what makes instalments work.
     */
    due:
      bill.payment === "quotation" ||
      bill.payment === "paid" ||
      bill.status === "void"
        ? 0
        : round2(Math.max(0, bill.total - paid)),
    payment: bill.payment as BillPayment,
    chequeNo: bill.chequeNo ?? null,
    status: bill.status as BillStatus,
    issuedBy: String(bill.issuedBy),
    createdAt: (bill.createdAt as Date).toISOString(),
    voidedAt: bill.voidedAt ? bill.voidedAt.toISOString() : null,
  }
}

/**
 * The review thread, or null when the quotation has never been shared.
 *
 * A revoked link reads as revoked rather than disappearing: the remarks are
 * still worth having, and "we withdrew this" is different from "we never
 * sent it".
 */
function toReviewDTO(
  bill: HydratedDocument<BillDocument>
): BillReviewDTO | null {
  const review = bill.review
  if (!review?.invitedAt) return null

  return {
    status: (review.status ?? "pending") as ReviewStatus,
    invitedTo: review.invitedTo ?? null,
    invitedAt: (review.invitedAt as Date).toISOString(),
    expiresAt: review.expiresAt
      ? (review.expiresAt as Date).toISOString()
      : null,
    revoked: Boolean(review.revokedAt),
    decidedAt: review.decidedAt
      ? (review.decidedAt as Date).toISOString()
      : null,
    clientName: review.clientName ?? null,
    remarks: (review.remarks ?? []).map((one) => ({
      lineIndex: one.lineIndex ?? null,
      text: one.text,
      author: one.author,
      fromClient: one.fromClient,
      at: (one.at as Date).toISOString(),
    })),
    token: review.token ?? null,
  }
}

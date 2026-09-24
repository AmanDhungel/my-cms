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
  EXPENSE_KINDS,
  PAYMENT_METHODS,
  type ExpenseKind,
  type PaymentMethod,
} from "@/lib/work-constants"

export { EXPENSE_KINDS, type ExpenseKind }

/**
 * One line of a stock purchase: which item, how many, and what each one cost.
 *
 * The name and unit are snapshotted alongside the reference for the same
 * reason a bill snapshots them — an item renamed or deleted next year must
 * not rewrite what a purchase said at the time.
 */
const purchaseLineSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "InventoryItem" },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    unit: { type: String, required: true, trim: true, maxlength: 12 },
    qty: { type: Number, required: true, min: 0 },
    /** Per unit, and the thing a selling price alone could never tell you. */
    cost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

/**
 * Money the business spent.
 *
 * Every kind but one is a cost of running the month. "stock" is different:
 * buying goods from a vendor converts cash into shelf, so it raises the item
 * and records what it cost, and only turns into a cost through the goods
 * being sold. Keeping both in one collection means one ledger, one filter and
 * one total, with the profit report the only place the difference matters.
 */
const expenseSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    kind: { type: String, required: true, enum: EXPENSE_KINDS },

    /** Who it went to, as typed: a vendor, a landlord, a utility, a person. */
    payee: { type: String, required: true, trim: true, maxlength: 140 },
    /** The party's own record, when one was chosen. This is what a ledger reads. */
    partyRef: { type: Schema.Types.ObjectId, ref: "Customer" },
    /** Set for salary and commission, so the person's own record can be found. */
    employee: { type: Schema.Types.ObjectId, ref: "User" },

    /**
     * The whole amount. For a purchase it is the sum of the lines and is
     * written by the server, never accepted from the request.
     */
    amount: { type: Number, required: true, min: 0 },

    method: {
      type: String,
      required: true,
      enum: PAYMENT_METHODS,
      default: "cash",
    },
    /** Cheque number, bill number from the vendor, transaction id. */
    reference: { type: String, trim: true, maxlength: 60 },
    note: { type: String, trim: true, maxlength: 500 },

    /**
     * The day the money went out, stored as the start of that day in the
     * workspace's zone so it reads back as the date that was typed.
     */
    spentOn: { type: Date, required: true },

    /** Only a stock purchase has any. */
    lines: { type: [purchaseLineSchema], default: [] },

    /**
     * Which bank, wallet or drawer it moved through.
     *
     * Optional, because the ledger predates accounts and those rows are still
     * true — they simply cannot be attributed to one. Everything entered from
     * now on names one.
     */
    account: { type: Schema.Types.ObjectId, ref: "Account" },
    /**
     * The mirrored row on the Payments ledger, so an edit or a delete here
     * moves that one too rather than leaving the two to drift apart.
     */
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },

    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

expenseSchema.index({ business: 1, spentOn: -1 })
expenseSchema.index({ business: 1, kind: 1, spentOn: -1 })
// Everything one supplier has been paid, which is the ledger's question.
expenseSchema.index({ business: 1, partyRef: 1, spentOn: -1 })
// The profit report walks purchases per item to work out what stock cost.
expenseSchema.index({ business: 1, "lines.item": 1 })

export type ExpenseDocument = InferSchemaType<typeof expenseSchema>

export const Expense: Model<ExpenseDocument> =
  (models.Expense as Model<ExpenseDocument>) ??
  model<ExpenseDocument>("Expense", expenseSchema)

export type PurchaseLineDTO = {
  itemId: string | null
  name: string
  unit: string
  qty: number
  cost: number
  /** qty × cost, worked out here so no caller has to remember to. */
  total: number
}

export type ExpenseDTO = {
  id: string
  kind: ExpenseKind
  payee: string
  partyId: string | null
  accountId: string | null
  employee: { id: string; name: string } | null
  amount: number
  method: PaymentMethod
  reference: string | null
  note: string | null
  /** "YYYY-MM-DD" in the workspace's zone, which is how it was entered. */
  spentOn: string
  lines: PurchaseLineDTO[]
  recordedBy: { id: string; name: string } | null
  createdAt: string
}

type MaybePopulated =
  | { _id: unknown; name?: string }
  | Schema.Types.ObjectId
  | null
  | undefined

/** A reference is a plain id unless the query populated it. */
function named(ref: MaybePopulated) {
  if (!ref) return null
  if (typeof ref === "object" && "name" in ref) {
    return { id: String(ref._id), name: ref.name ?? "" }
  }
  return { id: String(ref), name: "" }
}

export function toExpenseDTO(
  expense: HydratedDocument<ExpenseDocument>,
  timeZone: string
): ExpenseDTO {
  return {
    id: String(expense._id),
    kind: expense.kind as ExpenseKind,
    payee: expense.payee,
    partyId: expense.partyRef ? String(expense.partyRef) : null,
    accountId: expense.account ? String(expense.account) : null,
    employee: named(expense.employee as MaybePopulated),
    amount: expense.amount,
    method: expense.method as PaymentMethod,
    reference: expense.reference ?? null,
    note: expense.note ?? null,
    spentOn: dayKeyInZone(expense.spentOn, timeZone),
    lines: (expense.lines ?? []).map((line) => ({
      itemId: line.item ? String(line.item) : null,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      cost: line.cost,
      total: Math.round(line.qty * line.cost * 100) / 100,
    })),
    recordedBy: named(expense.recordedBy as MaybePopulated),
    createdAt: (expense.createdAt as Date).toISOString(),
  }
}

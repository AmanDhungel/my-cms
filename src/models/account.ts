import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { ACCOUNT_KINDS, type AccountKind } from "@/lib/work-constants"

export { ACCOUNT_KINDS, type AccountKind }

/**
 * Somewhere money sits: a bank account, a wallet, or the cash drawer.
 *
 * Every payment and every expense names one, so "how much have we got" stops
 * being a question anyone has to add up by hand. The opening balance is what
 * was there on the day the account was added to EMS — the business existed
 * before the software did, and a balance that started at zero would be wrong
 * from the first day.
 *
 * The current balance is never stored. It is the opening balance plus
 * everything that has moved since, worked out on demand, because a stored
 * total is a number that can drift away from the rows behind it.
 */
const accountSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 90 },
    kind: { type: String, required: true, enum: ACCOUNT_KINDS, default: "bank" },

    /** Account number, wallet ID — whatever identifies it to its provider. */
    reference: { type: String, trim: true, maxlength: 60 },
    /** The branch, or the phone number a wallet is registered to. */
    detail: { type: String, trim: true, maxlength: 120 },

    /** What was in it when it was first entered here. May be negative. */
    openingBalance: { type: Number, required: true, default: 0 },
    /** The day that opening balance was true. */
    openedOn: { type: Date },

    /**
     * The one offered first. Exactly zero or one per workspace, which the
     * route keeps true by clearing the others whenever one is set.
     */
    isDefault: { type: Boolean, required: true, default: false },

    /**
     * A closed account. Kept rather than deleted, because the payments that
     * went through it still point at it and still have to read correctly.
     */
    archivedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

accountSchema.index({ business: 1, name: 1 }, { unique: true })
accountSchema.index({ business: 1, archivedAt: 1 })

export type AccountDocument = InferSchemaType<typeof accountSchema>

export const Account: Model<AccountDocument> =
  (models.Account as Model<AccountDocument>) ??
  model<AccountDocument>("Account", accountSchema)

export type AccountDTO = {
  id: string
  name: string
  kind: AccountKind
  reference: string | null
  detail: string | null
  openingBalance: number
  openedOn: string | null
  isDefault: boolean
  archived: boolean
  /** Opening balance plus everything that has moved. Worked out per request. */
  balance: number
  /** What has come in and gone out since, so the balance can be read back. */
  received: number
  paidOut: number
  movements: number
  createdAt: string
}

export type AccountTotals = {
  received: number
  paidOut: number
  movements: number
}

export function toAccountDTO(
  account: HydratedDocument<AccountDocument>,
  totals: AccountTotals = { received: 0, paidOut: 0, movements: 0 }
): AccountDTO {
  const opening = account.openingBalance ?? 0
  return {
    id: String(account._id),
    name: account.name,
    kind: account.kind as AccountKind,
    reference: account.reference ?? null,
    detail: account.detail ?? null,
    openingBalance: opening,
    openedOn: account.openedOn
      ? (account.openedOn as Date).toISOString()
      : null,
    isDefault: account.isDefault,
    archived: Boolean(account.archivedAt),
    balance: Math.round((opening + totals.received - totals.paidOut) * 100) / 100,
    received: Math.round(totals.received * 100) / 100,
    paidOut: Math.round(totals.paidOut * 100) / 100,
    movements: totals.movements,
    createdAt: (account.createdAt as Date).toISOString(),
  }
}

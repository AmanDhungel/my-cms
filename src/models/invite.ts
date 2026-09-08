import { createHash, randomBytes } from "node:crypto"
import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { SHIFTS } from "@/lib/validations/auth"

export const INVITE_ROLES = ["supervisor", "employee"] as const
export type InviteRole = (typeof INVITE_ROLES)[number]

/** Seven days, matching the copy in the owner's invite dialog. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const inviteSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    role: { type: String, required: true, enum: INVITE_ROLES },
    shift: { type: String, required: true, enum: SHIFTS },
    message: { type: String, trim: true, maxlength: 500 },
    /**
     * Only the hash is stored. The raw token exists once, in the link handed
     * to the invitee — a database leak can't be replayed into accounts.
     */
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

// One live invite per email per workspace; accepted ones are kept for history.
inviteSchema.index(
  { business: 1, email: 1 },
  { unique: true, partialFilterExpression: { acceptedAt: { $exists: false } } }
)

export type InviteDocument = InferSchemaType<typeof inviteSchema>

export const Invite: Model<InviteDocument> =
  (models.Invite as Model<InviteDocument>) ??
  model<InviteDocument>("Invite", inviteSchema)

/** Returns the raw token (shown once) and the hash to persist. */
export function createInviteToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashInviteToken(token) }
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export type InviteDTO = {
  id: string
  name: string
  email: string
  phone: string
  role: InviteRole
  shift: string
  expiresAt: string
  acceptedAt: string | null
}

export function toInviteDTO(
  invite: HydratedDocument<InviteDocument>
): InviteDTO {
  return {
    id: String(invite._id),
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    role: invite.role,
    shift: invite.shift,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
  }
}

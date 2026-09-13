import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { MEMBER_STATUSES, type MemberStatus } from "@/lib/work-constants"

export { MEMBER_STATUSES, type MemberStatus }

export const USER_ROLES = ["owner", "supervisor", "employee"] as const
export type UserRole = (typeof USER_ROLES)[number]

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    /** Never returned by default — read it with `.select("+passwordHash")`. */
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: USER_ROLES,
      default: "employee",
    },
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** Working hours, set from the invite. Owners have none by default. */
    shift: { type: String, trim: true, maxlength: 32 },
    /**
     * "removed" keeps the row (tasks, check-ins and attendance all point at
     * it) while revoking every way in. Accepting another workspace's invite
     * with the same email moves the account there and makes it active again.
     */
    status: {
      type: String,
      required: true,
      enum: MEMBER_STATUSES,
      default: "active",
    },
    removedAt: { type: Date },
    /**
     * Set by a super admin. Unlike "removed" this is not a workspace matter:
     * the account keeps its place but every way in is shut.
     */
    blockedAt: { type: Date },
  },
  { timestamps: true }
)

export type UserDocument = InferSchemaType<typeof userSchema>

/**
 * `models.User ??` keeps hot reload from re-registering the model (mongoose
 * throws OverwriteModelError otherwise).
 */
export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) ??
  model<UserDocument>("User", userSchema)

export type UserDTO = {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  shift: string | null
  status: MemberStatus
  blockedAt: string | null
  businessId: string
}

/** The only shape a user is allowed to leave the server in. */
export function toUserDTO(user: HydratedDocument<UserDocument>): UserDTO {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    shift: user.shift ?? null,
    status: user.status,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null,
    businessId: String(user.business),
  }
}

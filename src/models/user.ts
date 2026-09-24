import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  MEMBER_STATUSES,
  PATTERN_KINDS,
  type MemberStatus,
} from "@/lib/work-constants"
import type { WeekPattern } from "@/lib/week"

export { MEMBER_STATUSES, type MemberStatus }

export const USER_ROLES = ["owner", "supervisor", "employee"] as const
export type UserRole = (typeof USER_ROLES)[number]

/** One day of a repeating week. Shaped exactly as the workspace's own. */
const dayPlanSchema = new Schema(
  {
    kind: { type: String, required: true, enum: PATTERN_KINDS },
    startTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
)

const weekField = {
  type: [dayPlanSchema],
  /**
   * Without this mongoose creates an empty array on every new document, and
   * an empty array is not seven days — which would fail the validator below
   * on a record that simply has no week.
   */
  default: undefined,
  validate: {
    validator: (list: unknown[] | undefined) =>
      list === undefined || list.length === 0 || list.length === 7,
    message: "A week has seven days",
  },
}

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
     * Their own repeating week, when it differs from the workspace's. Absent
     * means they follow the standard one.
     */
    week: weekField,
    /**
     * "removed" keeps the row (tickets, check-ins and attendance all point at
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
  week: WeekPattern | null
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
    week: (user.week?.length === 7
      ? user.week.map((day) => ({
          kind: day.kind,
          startTime: day.startTime ?? null,
          endTime: day.endTime ?? null,
        }))
      : null) as WeekPattern | null,
    status: user.status,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null,
    businessId: String(user.business),
  }
}

import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

export const USER_ROLES = ["owner", "employee"] as const
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
    businessId: String(user.business),
  }
}

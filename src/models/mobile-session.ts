import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose"

/**
 * One refresh token issued to the mobile app.
 *
 * The token itself is 256 random bits handed to the device once; only its
 * SHA-256 is stored, so a database leak can't be replayed. Every refresh
 * rotates it: the presented row is revoked and a new row in the same
 * `familyId` takes its place. Presenting a row that was already revoked
 * means a copy is in someone else's hands, so the whole family goes.
 *
 * Rows delete themselves when `expiresAt` passes (TTL index).
 */
const mobileSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    deviceName: { type: String, trim: true, maxlength: 120 },
    familyId: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true }
)

mobileSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
mobileSessionSchema.index({ userId: 1, revokedAt: 1 })
mobileSessionSchema.index({ familyId: 1 })

export type MobileSessionDocument = InferSchemaType<typeof mobileSessionSchema>

export const MobileSession: Model<MobileSessionDocument> =
  (models.MobileSession as Model<MobileSessionDocument>) ??
  model<MobileSessionDocument>("MobileSession", mobileSessionSchema)

import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { CREW_SIZES } from "@/lib/validations/auth"

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    crewSize: { type: String, required: true, enum: CREW_SIZES },
    /**
     * Day boundaries and lateness are computed here, not in the server's
     * zone: a UTC host would otherwise roll the day over mid-afternoon.
     */
    timeZone: { type: String, required: true, default: "Asia/Kathmandu" },
    /** PAN / VAT registration number, printed on tax invoices. */
    pan: { type: String, trim: true, maxlength: 30 },
    /** Percent added to a bill that has VAT switched on. Nepal is 13%. */
    vatRate: { type: Number, required: true, min: 0, max: 100, default: 13 },
    /**
     * The last bill number handed out. Incremented with $inc inside the
     * transaction that writes the bill, so two tills can never share a number.
     */
    billSeq: { type: Number, required: true, default: 0 },
    /**
     * Set by a super admin. A blocked workspace shuts out everyone in it,
     * whatever their role.
     */
    blockedAt: { type: Date },
    /** The user who created the workspace. */
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export type BusinessDocument = InferSchemaType<typeof businessSchema>

/**
 * `models.Business ??` keeps hot reload from re-registering the model
 * (mongoose throws OverwriteModelError otherwise).
 */
export const Business: Model<BusinessDocument> =
  (models.Business as Model<BusinessDocument>) ??
  model<BusinessDocument>("Business", businessSchema)

export type BusinessDTO = {
  id: string
  name: string
  crewSize: string
  timeZone: string
  pan: string | null
  vatRate: number
  blockedAt: string | null
  ownerId: string
}

export function toBusinessDTO(
  business: HydratedDocument<BusinessDocument>
): BusinessDTO {
  return {
    id: String(business._id),
    name: business.name,
    crewSize: business.crewSize,
    timeZone: business.timeZone,
    pan: business.pan ?? null,
    vatRate: business.vatRate,
    blockedAt: business.blockedAt ? business.blockedAt.toISOString() : null,
    ownerId: String(business.owner),
  }
}

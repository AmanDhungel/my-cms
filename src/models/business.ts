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
    ownerId: String(business.owner),
  }
}

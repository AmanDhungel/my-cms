import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { CHECK_IN_TYPES, type CheckInType } from "@/lib/work-constants"

export { CHECK_IN_TYPES, type CheckInType }

const checkInSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true, enum: CHECK_IN_TYPES },

    at: { type: Date, required: true },

    /**
     * Where the device said it was. Coordinates come from the browser and are
     * therefore only as trustworthy as the device — but the distance check
     * itself is done on the server, never in the client.
     */
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracyM: { type: Number, min: 0 },
    distanceM: { type: Number, required: true, min: 0 },
    insideFence: { type: Boolean, required: true },

    /** Required when `insideFence` is false — the owner sees it verbatim. */
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
)

checkInSchema.index({ task: 1, at: -1 })
checkInSchema.index({ user: 1, at: -1 })

export type CheckInDocument = InferSchemaType<typeof checkInSchema>

export const CheckIn: Model<CheckInDocument> =
  (models.CheckIn as Model<CheckInDocument>) ??
  model<CheckInDocument>("CheckIn", checkInSchema)

export type CheckInDTO = {
  id: string
  taskId: string
  type: CheckInType
  at: string
  distanceM: number
  insideFence: boolean
  reason: string | null
}

export function toCheckInDTO(
  entry: HydratedDocument<CheckInDocument>
): CheckInDTO {
  return {
    id: String(entry._id),
    taskId: String(entry.task),
    type: entry.type,
    at: entry.at.toISOString(),
    distanceM: entry.distanceM,
    insideFence: entry.insideFence,
    reason: entry.reason ?? null,
  }
}

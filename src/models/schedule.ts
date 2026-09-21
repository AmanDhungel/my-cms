import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { SCHEDULE_KINDS, type ScheduleKind } from "@/lib/work-constants"

export { SCHEDULE_KINDS, type ScheduleKind }

/**
 * One person's planned day. This is the roster — what someone is *meant* to
 * be doing — and is deliberately separate from attendance, which records what
 * actually happened. The two are compared, never merged.
 *
 * A person's `shift` on their user record is the standing default; a row here
 * overrides it for one day.
 */
const scheduleSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** "YYYY-MM-DD" in the workspace's zone, like attendance. */
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

    kind: { type: String, required: true, enum: SCHEDULE_KINDS, default: "work" },

    /** "HH:MM". Absent on an off or leave day, which has no hours. */
    startTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },

    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// One row per person per day — rostering someone twice is a mistake, not a
// second shift, and the index is what makes saving idempotent.
scheduleSchema.index({ user: 1, day: 1 }, { unique: true })
scheduleSchema.index({ business: 1, day: 1 })

export type ScheduleDocument = InferSchemaType<typeof scheduleSchema>

export const Schedule: Model<ScheduleDocument> =
  (models.Schedule as Model<ScheduleDocument>) ??
  model<ScheduleDocument>("Schedule", scheduleSchema)

export type ScheduleDTO = {
  id: string
  userId: string
  day: string
  kind: ScheduleKind
  startTime: string | null
  endTime: string | null
  note: string | null
}

export function toScheduleDTO(
  entry: HydratedDocument<ScheduleDocument>
): ScheduleDTO {
  return {
    id: String(entry._id),
    userId: String(entry.user),
    day: entry.day,
    kind: entry.kind as ScheduleKind,
    startTime: entry.startTime ?? null,
    endTime: entry.endTime ?? null,
    note: entry.note ?? null,
  }
}

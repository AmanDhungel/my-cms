import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  LATE_GRACE_MIN,
  type AttendanceSource,
  type AttendanceStatus,
} from "@/lib/work-constants"

export {
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  LATE_GRACE_MIN,
  type AttendanceSource,
  type AttendanceStatus,
}

const attendanceSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** "YYYY-MM-DD" in the workspace's time zone, not the server's. */
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

    inAt: { type: Date },
    outAt: { type: Date },

    /**
     * "manual" means the employee pressed Start/End shift; "derived" means it
     * came from a task check-in. Manual always wins on reconcile.
     */
    inSource: { type: String, enum: ATTENDANCE_SOURCES },
    outSource: { type: String, enum: ATTENDANCE_SOURCES },

    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_STATUSES,
      default: "present",
    },
    lateByMin: { type: Number, default: 0, min: 0 },

    /** Snapshot, so editing someone's shift doesn't rewrite their history. */
    shift: { type: String, trim: true, maxlength: 32 },
  },
  { timestamps: true }
)

attendanceSchema.index({ user: 1, day: 1 }, { unique: true })
attendanceSchema.index({ business: 1, day: -1 })

export type AttendanceDocument = InferSchemaType<typeof attendanceSchema>

export const Attendance: Model<AttendanceDocument> =
  (models.Attendance as Model<AttendanceDocument>) ??
  model<AttendanceDocument>("Attendance", attendanceSchema)

export type AttendanceDTO = {
  id: string
  day: string
  inAt: string | null
  outAt: string | null
  inSource: AttendanceSource | null
  outSource: AttendanceSource | null
  status: AttendanceStatus
  lateByMin: number
  shift: string | null
}

export function toAttendanceDTO(
  record: HydratedDocument<AttendanceDocument>
): AttendanceDTO {
  return {
    id: String(record._id),
    day: record.day,
    inAt: record.inAt ? record.inAt.toISOString() : null,
    outAt: record.outAt ? record.outAt.toISOString() : null,
    inSource: record.inSource ?? null,
    outSource: record.outSource ?? null,
    status: record.status,
    lateByMin: record.lateByMin ?? 0,
    shift: record.shift ?? null,
  }
}

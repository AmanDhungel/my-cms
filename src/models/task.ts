import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  DEFAULT_RADIUS_M,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/work-constants"

export {
  DEFAULT_RADIUS_M,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
}

const taskSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },

    /** Where the work is. `lat`/`lng` anchor the geofence, `site` labels it. */
    site: { type: String, required: true, trim: true, maxlength: 160 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    radiusM: {
      type: Number,
      required: true,
      min: 10,
      max: 5000,
      default: DEFAULT_RADIUS_M,
    },

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    assignee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      required: true,
      enum: TASK_STATUSES,
      default: "pending",
    },
    priority: {
      type: String,
      required: true,
      enum: TASK_PRIORITIES,
      default: "normal",
    },

    /** Why the assignee marked it blocked. Cleared when work resumes. */
    blockedReason: { type: String, trim: true, maxlength: 500 },

    /** Mirrors of the latest check-in/out, so lists don't need a second query. */
    checkedInAt: { type: Date },
    checkedOutAt: { type: Date },
  },
  { timestamps: true }
)

// The two queries that actually run: an employee's day, and an owner's board.
taskSchema.index({ assignee: 1, startAt: 1 })
taskSchema.index({ business: 1, startAt: -1 })
taskSchema.index({ project: 1, startAt: -1 })

export type TaskDocument = InferSchemaType<typeof taskSchema>

export const Task: Model<TaskDocument> =
  (models.Task as Model<TaskDocument>) ??
  model<TaskDocument>("Task", taskSchema)

export type TaskDTO = {
  id: string
  title: string
  description: string | null
  site: string
  lat: number
  lng: number
  radiusM: number
  startAt: string
  endAt: string
  status: TaskStatus
  priority: TaskPriority
  blockedReason: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  assignee: { id: string; name: string } | null
  project: { id: string; name: string } | null
}

/** A ref is either an id or, after `populate`, the document itself. */
type MaybePopulated =
  | { _id: unknown; name?: string }
  | Schema.Types.ObjectId
  | null
  | undefined

function named(ref: MaybePopulated) {
  if (!ref) return null
  if (typeof ref === "object" && "name" in ref) {
    return { id: String(ref._id), name: ref.name ?? "" }
  }
  return { id: String(ref), name: "" }
}

export function toTaskDTO(task: HydratedDocument<TaskDocument>): TaskDTO {
  return {
    id: String(task._id),
    title: task.title,
    description: task.description ?? null,
    site: task.site,
    lat: task.lat,
    lng: task.lng,
    radiusM: task.radiusM,
    startAt: task.startAt.toISOString(),
    endAt: task.endAt.toISOString(),
    status: task.status,
    priority: task.priority,
    blockedReason: task.blockedReason ?? null,
    checkedInAt: task.checkedInAt ? task.checkedInAt.toISOString() : null,
    checkedOutAt: task.checkedOutAt ? task.checkedOutAt.toISOString() : null,
    assignee: named(task.assignee as MaybePopulated),
    project: named(task.project as MaybePopulated),
  }
}

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

    /**
     * A task can be crewed by several people. `assignee` (singular) is the
     * shape this used to have and is left on migrated documents so the change
     * can be rolled back; nothing reads it.
     */
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (list: unknown[]) => list.length > 0,
        message: "A task needs at least one person on it",
      },
    },
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

    /**
     * Who is standing on site right now, one entry each. Mirrored here so a
     * list doesn't need a second query per task; the CheckIn collection stays
     * the record of what happened.
     */
    openCheckIns: {
      type: [
        {
          _id: false,
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
        },
      ],
      default: [],
    },
    /** The last departure by anyone, for "finished at" style readouts. */
    checkedOutAt: { type: Date },
  },
  { timestamps: true }
)

// The two queries that actually run: an employee's day, and an owner's board.
taskSchema.index({ assignees: 1, startAt: 1 })
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
  /** Everyone standing on site right now. */
  onSite: { id: string; name: string; at: string }[]
  /**
   * The viewer's own open check-in, when `toTaskDTO` was given one. This is
   * what the crew app keys its Check in / Check out button off — with several
   * people on a task, "is anyone here" is a different question from "am I".
   */
  myCheckedInAt: string | null
  checkedOutAt: string | null
  assignees: { id: string; name: string }[]
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

export function toTaskDTO(
  task: HydratedDocument<TaskDocument>,
  viewerId?: string
): TaskDTO {
  const assignees = (task.assignees ?? [])
    .map((ref) => named(ref as MaybePopulated))
    .filter((entry): entry is { id: string; name: string } => entry !== null)

  const byId = new Map(assignees.map((entry) => [entry.id, entry.name]))

  const onSite = (task.openCheckIns ?? []).map((entry) => ({
    id: String(entry.user),
    name: byId.get(String(entry.user)) ?? "",
    at: entry.at.toISOString(),
  }))

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
    onSite,
    myCheckedInAt:
      onSite.find((entry) => entry.id === viewerId)?.at ?? null,
    checkedOutAt: task.checkedOutAt ? task.checkedOutAt.toISOString() : null,
    assignees,
    project: named(task.project as MaybePopulated),
  }
}

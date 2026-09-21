import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  OPERATION_KINDS,
  OPERATION_STATUSES,
  TASK_PRIORITIES,
  type OperationKind,
  type OperationStatus,
  type TaskPriority,
} from "@/lib/work-constants"

export {
  OPERATION_KINDS,
  OPERATION_STATUSES,
  type OperationKind,
  type OperationStatus,
}

/**
 * A dated thing that isn't a task: a meeting, an installation date, a
 * follow-up or a deadline.
 *
 * All four are the same record — a title, a time, people, a state — so they
 * share one collection and one calendar. Splitting them into four models
 * would buy nothing but four copies of the same CRUD.
 */
const operationSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    kind: { type: String, required: true, enum: OPERATION_KINDS },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    details: { type: String, trim: true, maxlength: 2000 },

    /** When it happens, or is due. Always set. */
    startAt: { type: Date, required: true },
    /** When it ends. A deadline or a follow-up usually has none. */
    endAt: { type: Date },
    /**
     * A date rather than a moment. Deadlines and follow-ups default to this;
     * the calendar draws them as a band rather than a time.
     */
    allDay: { type: Boolean, required: true, default: false },

    status: {
      type: String,
      required: true,
      enum: OPERATION_STATUSES,
      default: "scheduled",
    },
    priority: {
      type: String,
      required: true,
      enum: TASK_PRIORITIES,
      default: "normal",
    },

    /** Who is on it. Optional — a deadline can belong to nobody in particular. */
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    /** Installations and follow-ups are usually about somebody we bill. */
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    project: { type: Schema.Types.ObjectId, ref: "Project" },

    /** Where it is. Free text — a room, a site, a video link. */
    location: { type: String, trim: true, maxlength: 200 },

    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// The two queries that run: one kind's list, and the calendar's month.
operationSchema.index({ business: 1, kind: 1, startAt: 1 })
operationSchema.index({ business: 1, startAt: 1 })

export type OperationDocument = InferSchemaType<typeof operationSchema>

export const Operation: Model<OperationDocument> =
  (models.Operation as Model<OperationDocument>) ??
  model<OperationDocument>("Operation", operationSchema)

export type OperationDTO = {
  id: string
  kind: OperationKind
  title: string
  details: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  status: OperationStatus
  priority: TaskPriority
  assignees: { id: string; name: string }[]
  customer: { id: string; name: string } | null
  project: { id: string; name: string } | null
  location: string | null
  completedAt: string | null
  createdAt: string
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

export function toOperationDTO(
  entry: HydratedDocument<OperationDocument>
): OperationDTO {
  return {
    id: String(entry._id),
    kind: entry.kind as OperationKind,
    title: entry.title,
    details: entry.details ?? null,
    startAt: entry.startAt.toISOString(),
    endAt: entry.endAt ? entry.endAt.toISOString() : null,
    allDay: entry.allDay,
    status: entry.status as OperationStatus,
    priority: entry.priority as TaskPriority,
    assignees: (entry.assignees ?? [])
      .map((ref) => named(ref as MaybePopulated))
      .filter((one): one is { id: string; name: string } => one !== null),
    customer: named(entry.customer as MaybePopulated),
    project: named(entry.project as MaybePopulated),
    location: entry.location ?? null,
    completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
    createdAt: (entry.createdAt as Date).toISOString(),
  }
}

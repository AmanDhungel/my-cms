import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  REQUEST_KINDS,
  REQUEST_STATUSES,
  type RequestKind,
  type RequestStatus,
} from "@/lib/work-constants"

export {
  REQUEST_KINDS,
  REQUEST_STATUSES,
  type RequestKind,
  type RequestStatus,
}

const requestSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    kind: { type: String, required: true, enum: REQUEST_KINDS },
    message: { type: String, required: true, trim: true, maxlength: 1000 },

    /** leave */
    startDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    /** advance, in the workspace's currency — no conversion is attempted. */
    amount: { type: Number, min: 0 },
    /** material */
    task: { type: Schema.Types.ObjectId, ref: "Task" },

    status: {
      type: String,
      required: true,
      enum: REQUEST_STATUSES,
      default: "pending",
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
)

requestSchema.index({ user: 1, createdAt: -1 })
requestSchema.index({ business: 1, status: 1, createdAt: -1 })

export type RequestDocument = InferSchemaType<typeof requestSchema>

export const WorkRequest: Model<RequestDocument> =
  (models.Request as Model<RequestDocument>) ??
  model<RequestDocument>("Request", requestSchema)

export type RequestDTO = {
  id: string
  kind: RequestKind
  message: string
  startDate: string | null
  endDate: string | null
  amount: number | null
  taskId: string | null
  status: RequestStatus
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
  user: { id: string; name: string } | null
}

type MaybePopulatedUser =
  | { _id: unknown; name?: string }
  | Schema.Types.ObjectId
  | null
  | undefined

export function toRequestDTO(
  request: HydratedDocument<RequestDocument>
): RequestDTO {
  const user = request.user as MaybePopulatedUser

  return {
    id: String(request._id),
    kind: request.kind,
    message: request.message,
    startDate: request.startDate ?? null,
    endDate: request.endDate ?? null,
    amount: request.amount ?? null,
    taskId: request.task ? String(request.task) : null,
    status: request.status,
    decisionNote: request.decisionNote ?? null,
    decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
    createdAt: (request.createdAt as Date).toISOString(),
    user:
      user && typeof user === "object" && "name" in user
        ? { id: String(user._id), name: user.name ?? "" }
        : user
          ? { id: String(user), name: "" }
          : null,
  }
}

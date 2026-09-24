import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { dayKeyInZone } from "@/lib/time"
import {
  MAINTENANCE_STATUSES,
  type MaintenanceStatus,
} from "@/lib/work-constants"

export { MAINTENANCE_STATUSES, type MaintenanceStatus }

/**
 * Something on the bench.
 *
 * An item that came in to be repaired: what it is, whose it is, what is wrong
 * with it and where the repair has got to. The serial number matters more
 * than the name — two identical pumps are told apart by nothing else, and
 * handing the wrong one back is the failure this record exists to prevent.
 *
 * Pictures are the other half of that: what it looked like on arrival is the
 * only defence against an argument about a scratch afterwards.
 */
const maintenanceSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },

    item: { type: String, required: true, trim: true, maxlength: 140 },
    /**
     * Make and model, where the item itself doesn't say.
     *
     * Not called `model`: that is a method on every Mongoose document, and a
     * field by the same name shadows it.
     */
    makeModel: { type: String, trim: true, maxlength: 120 },
    /** What tells this one apart from an identical one on the next shelf. */
    serialNumber: { type: String, trim: true, maxlength: 80 },

    /** Whose it is. A party when they are on file, otherwise just a name. */
    owner: { type: String, trim: true, maxlength: 140 },
    ownerRef: { type: Schema.Types.ObjectId, ref: "Customer" },

    /** What needs repairing, as reported. */
    fault: { type: String, required: true, trim: true, maxlength: 1000 },
    /** What was actually found and done. */
    diagnosis: { type: String, trim: true, maxlength: 2000 },

    status: {
      type: String,
      required: true,
      enum: MAINTENANCE_STATUSES,
      default: "received",
    },

    receivedAt: { type: Date, required: true },
    /** Promised back by. Not every job has one. */
    dueAt: { type: Date },
    returnedAt: { type: Date },

    /** What the repair cost, once it is known. */
    cost: { type: Number, min: 0 },

    /** Who is working on it. */
    assignee: { type: Schema.Types.ObjectId, ref: "User" },

    /** Photographs, as stored URLs. */
    photos: {
      type: [{ type: String, trim: true, maxlength: 600 }],
      default: [],
    },

    note: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

maintenanceSchema.index({ business: 1, status: 1, receivedAt: -1 })
// Looking one up by the number on its plate, which is how they arrive.
maintenanceSchema.index({ business: 1, serialNumber: 1 })

export type MaintenanceDocument = InferSchemaType<typeof maintenanceSchema>

export const MaintenanceItem: Model<MaintenanceDocument> =
  (models.MaintenanceItem as Model<MaintenanceDocument>) ??
  model<MaintenanceDocument>("MaintenanceItem", maintenanceSchema)

export type MaintenanceDTO = {
  id: string
  item: string
  makeModel: string | null
  serialNumber: string | null
  owner: string | null
  ownerId: string | null
  fault: string
  diagnosis: string | null
  status: MaintenanceStatus
  /** "YYYY-MM-DD" in the workspace's zone, which is how they were entered. */
  receivedAt: string
  dueAt: string | null
  returnedAt: string | null
  cost: number | null
  assignee: { id: string; name: string } | null
  photos: string[]
  note: string | null
  createdAt: string
}

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

const text = (value: unknown) => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed === "" ? null : trimmed
}

export function toMaintenanceDTO(
  row: HydratedDocument<MaintenanceDocument>,
  timeZone: string
): MaintenanceDTO {
  return {
    id: String(row._id),
    item: row.item,
    makeModel: text(row.makeModel),
    serialNumber: text(row.serialNumber),
    owner: text(row.owner),
    ownerId: row.ownerRef ? String(row.ownerRef) : null,
    fault: row.fault,
    diagnosis: text(row.diagnosis),
    status: row.status as MaintenanceStatus,
    receivedAt: dayKeyInZone(row.receivedAt as Date, timeZone),
    dueAt: row.dueAt ? dayKeyInZone(row.dueAt as Date, timeZone) : null,
    returnedAt: row.returnedAt
      ? dayKeyInZone(row.returnedAt as Date, timeZone)
      : null,
    cost: row.cost ?? null,
    assignee: named(row.assignee as MaybePopulated),
    photos: (row.photos ?? []).filter(Boolean),
    note: text(row.note),
    createdAt: (row.createdAt as Date).toISOString(),
  }
}

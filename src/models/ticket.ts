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
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/work-constants"
import { BLOCKER_REASONS, type BlockerReason } from "@/lib/work-constants"

export {
  DEFAULT_RADIUS_M,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
}

/** One thing the job used, and what it was worth. */
const materialSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "InventoryItem" },
    /** Snapshotted, so a renamed item doesn't rewrite an old ticket. */
    name: { type: String, required: true, trim: true, maxlength: 140 },
    unit: { type: String, required: true, trim: true, maxlength: 12 },
    qty: { type: Number, required: true, min: 0 },
    /** Per unit, taken off the item's recorded cost when there is one. */
    unitCost: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
)

/** Something the job is short of, so somebody knows what to bring. */
const shortageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    qty: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 12 },
  },
  { _id: false }
)

const ticketSchema = new Schema(
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
     * A ticket can be crewed by several people. `assignee` (singular) is the
     * shape this used to have and is left on migrated documents so the change
     * can be rolled back; nothing reads it.
     */
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (list: unknown[]) => list.length > 0,
        message: "A ticket needs at least one person on it",
      },
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      required: true,
      enum: TICKET_STATUSES,
      default: "pending",
    },
    priority: {
      type: String,
      required: true,
      enum: TICKET_PRIORITIES,
      default: "normal",
    },

    /** Why the assignee marked it blocked. Cleared when work resumes. */
    blockedReason: { type: String, trim: true, maxlength: 500 },

    /**
     * What is stopping it, in a shape the owner can act on.
     *
     * Sits alongside `blockedReason` rather than replacing it: that field is
     * the one-line summary shown everywhere a ticket appears, and this is the
     * detail behind it — including what is short, which is the thing somebody
     * has to go and buy.
     */
    blocker: {
      reason: { type: String, enum: BLOCKER_REASONS },
      note: { type: String, trim: true, maxlength: 800 },
      /** Material the job is waiting on. Empty for every other reason. */
      needs: {
        type: [shortageSchema],
        default: [],
      },
      raisedAt: { type: Date },
      raisedBy: { type: Schema.Types.ObjectId, ref: "User" },
      clearedAt: { type: Date },
    },

    /**
     * What the job actually consumed.
     *
     * Recorded by whoever did the work, so the owner can see what a ticket
     * cost in material rather than guessing. Deliberately does not move the
     * shelf: the same items are usually billed to the customer, and taking
     * them off here as well would count one cable twice.
     */
    materials: { type: [materialSchema], default: [] },

    /**
     * Who is standing on site right now, one entry each. Mirrored here so a
     * list doesn't need a second query per ticket; the CheckIn collection stays
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
ticketSchema.index({ assignees: 1, startAt: 1 })
ticketSchema.index({ business: 1, startAt: -1 })
ticketSchema.index({ project: 1, startAt: -1 })

export type TicketDocument = InferSchemaType<typeof ticketSchema>

export const Ticket: Model<TicketDocument> =
  (models.Ticket as Model<TicketDocument>) ??
  model<TicketDocument>("Ticket", ticketSchema)

export type TicketDTO = {
  id: string
  title: string
  description: string | null
  site: string
  lat: number
  lng: number
  radiusM: number
  startAt: string
  endAt: string
  status: TicketStatus
  priority: TicketPriority
  blockedReason: string | null
  blocker: {
    reason: BlockerReason | null
    note: string | null
    needs: { name: string; qty: number | null; unit: string | null }[]
    raisedAt: string | null
  } | null
  materials: {
    itemId: string | null
    name: string
    unit: string
    qty: number
    unitCost: number
    /** qty × unitCost, so no caller has to remember to. */
    total: number
  }[]
  /** What the whole job consumed, at cost. */
  materialsTotal: number
  /** Everyone standing on site right now. */
  onSite: { id: string; name: string; at: string }[]
  /**
   * The viewer's own open check-in, when `toTicketDTO` was given one. This is
   * what the crew app keys its Check in / Check out button off — with several
   * people on a ticket, "is anyone here" is a different question from "am I".
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

export function toTicketDTO(
  ticket: HydratedDocument<TicketDocument>,
  viewerId?: string
): TicketDTO {
  const assignees = (ticket.assignees ?? [])
    .map((ref) => named(ref as MaybePopulated))
    .filter((entry): entry is { id: string; name: string } => entry !== null)

  const byId = new Map(assignees.map((entry) => [entry.id, entry.name]))

  const onSite = (ticket.openCheckIns ?? []).map((entry) => ({
    id: String(entry.user),
    name: byId.get(String(entry.user)) ?? "",
    at: entry.at.toISOString(),
  }))

  return {
    id: String(ticket._id),
    title: ticket.title,
    description: ticket.description ?? null,
    site: ticket.site,
    lat: ticket.lat,
    lng: ticket.lng,
    radiusM: ticket.radiusM,
    startAt: ticket.startAt.toISOString(),
    endAt: ticket.endAt.toISOString(),
    status: ticket.status,
    priority: ticket.priority,
    blockedReason: ticket.blockedReason ?? null,
    blocker:
      // Only while it is actually raised: a cleared blocker is history, and
      // showing it beside a ticket back in progress would read as current.
      ticket.blocker?.raisedAt && !ticket.blocker.clearedAt
        ? {
            reason: (ticket.blocker.reason ?? null) as BlockerReason | null,
            note: ticket.blocker.note ?? null,
            needs: (ticket.blocker.needs ?? []).map((one) => ({
              name: one.name,
              qty: one.qty ?? null,
              unit: one.unit ?? null,
            })),
            raisedAt: (ticket.blocker.raisedAt as Date).toISOString(),
          }
        : null,
    materials: (ticket.materials ?? []).map((one) => ({
      itemId: one.item ? String(one.item) : null,
      name: one.name,
      unit: one.unit,
      qty: one.qty,
      unitCost: one.unitCost,
      total: Math.round(one.qty * one.unitCost * 100) / 100,
    })),
    materialsTotal:
      Math.round(
        (ticket.materials ?? []).reduce(
          (sum, one) => sum + one.qty * one.unitCost,
          0
        ) * 100
      ) / 100,
    onSite,
    myCheckedInAt:
      onSite.find((entry) => entry.id === viewerId)?.at ?? null,
    checkedOutAt: ticket.checkedOutAt ? ticket.checkedOutAt.toISOString() : null,
    assignees,
    project: named(ticket.project as MaybePopulated),
  }
}

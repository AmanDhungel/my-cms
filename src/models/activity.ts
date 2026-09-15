import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGETS,
  type ActivityAction,
  type ActivityTarget,
} from "@/lib/work-constants"

export {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGETS,
  type ActivityAction,
  type ActivityTarget,
}

/**
 * The workspace's audit trail. One row per event — not per recipient, and
 * never skipping the person who did it, which is what separates this from a
 * notification. The owner reads it to answer "who moved that, and when".
 *
 * Rows are written and never updated. Nothing here is derived at read time,
 * so a task renamed tomorrow doesn't rewrite what yesterday's entry said.
 */
const activitySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },

    action: { type: String, required: true, enum: ACTIVITY_ACTIONS },

    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /**
     * Snapshot of the actor's name. Kept so a removed member's actions still
     * read as theirs rather than collapsing to a dangling reference.
     */
    actorName: { type: String, required: true, trim: true, maxlength: 120 },

    /** What it was about — a task title, a project name, a person's name. */
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    /** The second line: a site, a reason, a distance. */
    detail: { type: String, trim: true, maxlength: 500 },

    /** Status moves record both ends, so the log reads as a transition. */
    from: { type: String, trim: true, maxlength: 40 },
    to: { type: String, trim: true, maxlength: 40 },

    targetKind: { type: String, enum: ACTIVITY_TARGETS },
    targetId: { type: Schema.Types.ObjectId },
    /** Where clicking the row should land. */
    href: { type: String, trim: true, maxlength: 200 },

    at: { type: Date, required: true },
  },
  { timestamps: true }
)

// The only query that runs: one workspace's entries, newest first, over a day.
activitySchema.index({ business: 1, at: -1 })

export type ActivityDocument = InferSchemaType<typeof activitySchema>

export const Activity: Model<ActivityDocument> =
  (models.Activity as Model<ActivityDocument>) ??
  model<ActivityDocument>("Activity", activitySchema)

export type ActivityDTO = {
  id: string
  action: ActivityAction
  actorId: string
  actorName: string
  subject: string
  detail: string | null
  from: string | null
  to: string | null
  targetKind: ActivityTarget | null
  targetId: string | null
  href: string | null
  at: string
}

export function toActivityDTO(
  entry: HydratedDocument<ActivityDocument>
): ActivityDTO {
  return {
    id: String(entry._id),
    action: entry.action as ActivityAction,
    actorId: String(entry.actor),
    actorName: entry.actorName,
    subject: entry.subject,
    detail: entry.detail ?? null,
    from: entry.from ?? null,
    to: entry.to ?? null,
    targetKind: (entry.targetKind as ActivityTarget) ?? null,
    targetId: entry.targetId ? String(entry.targetId) : null,
    href: entry.href ?? null,
    at: entry.at.toISOString(),
  }
}

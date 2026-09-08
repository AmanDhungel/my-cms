import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import {
  NOTIFICATION_KINDS,
  type NotificationKind,
} from "@/lib/work-constants"

export { NOTIFICATION_KINDS, type NotificationKind }

const notificationSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    /** Who should see it. One row per recipient, not per event. */
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, trim: true, maxlength: 500 },
    /** Where clicking it should land. */
    href: { type: String, trim: true, maxlength: 200 },

    /** The person the event is about, when that isn't the recipient. */
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    task: { type: Schema.Types.ObjectId, ref: "Task" },

    readAt: { type: Date },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ user: 1, readAt: 1 })

export type NotificationDocument = InferSchemaType<typeof notificationSchema>

export const Notification: Model<NotificationDocument> =
  (models.Notification as Model<NotificationDocument>) ??
  model<NotificationDocument>("Notification", notificationSchema)

export type NotificationDTO = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  href: string | null
  readAt: string | null
  createdAt: string
}

export function toNotificationDTO(
  entry: HydratedDocument<NotificationDocument>
): NotificationDTO {
  return {
    id: String(entry._id),
    kind: entry.kind,
    title: entry.title,
    body: entry.body ?? null,
    href: entry.href ?? null,
    readAt: entry.readAt ? entry.readAt.toISOString() : null,
    createdAt: (entry.createdAt as Date).toISOString(),
  }
}

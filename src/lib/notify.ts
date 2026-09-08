import type { Types } from "mongoose"

import { Notification } from "@/models/notification"
import type { NotificationKind } from "@/lib/work-constants"
import { User } from "@/models/user"

type Id = string | Types.ObjectId

type Event = {
  businessId: Id
  kind: NotificationKind
  title: string
  body?: string
  href?: string
  actor?: Id
  task?: Id
}

/**
 * A notification is a side effect of something that already succeeded, so a
 * failure here is logged and swallowed — it must never roll back the check-in
 * or decision that produced it.
 */
export async function notifyUser(event: Event & { userId: Id }) {
  try {
    await Notification.create(row(event.userId, event))
  } catch (error) {
    console.error("[notify]", error)
  }
}

/** Fans out to everyone who runs the workspace, minus the actor themselves. */
export async function notifySupervisors(event: Event) {
  try {
    const recipients = await User.find({
      business: event.businessId,
      role: { $in: ["owner", "supervisor"] },
      ...(event.actor ? { _id: { $ne: event.actor } } : {}),
    }).select("_id")

    if (recipients.length === 0) return

    await Notification.insertMany(
      recipients.map((recipient) => row(recipient._id, event))
    )
  } catch (error) {
    console.error("[notify]", error)
  }
}

function row(userId: Id, event: Event) {
  return {
    business: event.businessId,
    user: userId,
    kind: event.kind,
    title: event.title,
    body: event.body,
    href: event.href,
    actor: event.actor,
    task: event.task,
  }
}

import type { Types } from "mongoose"

import { Activity } from "@/models/activity"
import type { ActivityAction, ActivityTarget } from "@/lib/work-constants"

type Id = string | Types.ObjectId

export type ActivityEvent = {
  businessId: Id
  action: ActivityAction
  /** Who did it, and their name at the time. */
  actorId: Id
  actorName: string
  subject: string
  detail?: string
  from?: string
  to?: string
  targetKind?: ActivityTarget
  targetId?: Id
  href?: string
  /** Defaults to now; pass it when the event has its own timestamp. */
  at?: Date
}

/**
 * Records something that already happened. Like `notifyUser`, a failure here
 * is logged and swallowed — an audit row must never roll back the check-in or
 * status change that produced it.
 */
export async function logActivity(event: ActivityEvent) {
  try {
    await Activity.create({
      business: event.businessId,
      action: event.action,
      actor: event.actorId,
      actorName: event.actorName,
      subject: event.subject,
      detail: event.detail,
      from: event.from,
      to: event.to,
      targetKind: event.targetKind,
      targetId: event.targetId,
      href: event.href,
      at: event.at ?? new Date(),
    })
  } catch (error) {
    console.error("[activity]", error)
  }
}

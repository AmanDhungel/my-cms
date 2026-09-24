/**
 * How the log reads on screen. Kept apart from `activity.ts` because that
 * file imports the model, and importing a *value* from a model drags mongoose
 * into the client bundle — the same reason the enums live in work-constants.
 */
import type { ActivityAction } from "@/lib/work-constants"

/** How each action reads in the log, with the subject appended by the UI. */
export const ACTION_VERBS: Record<ActivityAction, string> = {
  ticket_created: "assigned",
  ticket_updated: "edited",
  ticket_status: "moved",
  ticket_checked_in: "checked in to",
  ticket_checked_out: "checked out of",
  project_created: "created project",
  project_updated: "edited project",
  project_archived: "archived project",
  project_reopened: "reopened project",
  shift_started: "started their shift",
  shift_ended: "ended their shift",
  request_raised: "raised",
  request_decided: "decided",
  member_joined: "joined the workspace",
  member_updated: "updated",
  member_removed: "removed",
  operation_created: "scheduled",
  operation_updated: "edited",
  operation_status: "moved",
  operation_deleted: "deleted",
  schedule_set: "rostered",
  schedule_cleared: "cleared the roster for",
  expense_recorded: "recorded",
  expense_updated: "corrected",
  expense_deleted: "deleted",
  site_published: "put the website live at",
  site_unpublished: "took the website down at",
  maintenance_received: "took in",
  maintenance_updated: "updated",
  maintenance_status: "moved",
  maintenance_deleted: "removed",
  quote_shared: "sent for review",
  quote_reviewed: "heard back on",
  quote_revoked: "withdrew the review link for",
}

/**
 * Actions whose sentence is complete without a subject — "Kiran started their
 * shift" rather than "Kiran started their shift Kiran".
 */
export const SUBJECTLESS: readonly ActivityAction[] = [
  "shift_started",
  "shift_ended",
  "member_joined",
]

/** Which dot colour a row gets, grouped the way the feed already is. */
export const ACTION_TONE: Record<ActivityAction, string> = {
  ticket_created: "bg-s-progress",
  ticket_updated: "bg-s-progress",
  ticket_status: "bg-s-time",
  ticket_checked_in: "bg-s-done",
  ticket_checked_out: "bg-s-pending",
  project_created: "bg-p-500",
  project_updated: "bg-p-500",
  project_archived: "bg-n-400",
  project_reopened: "bg-p-500",
  shift_started: "bg-s-done",
  shift_ended: "bg-s-pending",
  request_raised: "bg-a-400",
  request_decided: "bg-s-time",
  member_joined: "bg-p-500",
  member_updated: "bg-s-progress",
  member_removed: "bg-s-overdue",
  operation_created: "bg-p-500",
  operation_updated: "bg-s-progress",
  operation_status: "bg-s-time",
  operation_deleted: "bg-s-overdue",
  schedule_set: "bg-s-progress",
  schedule_cleared: "bg-n-400",
  expense_recorded: "bg-a-400",
  expense_updated: "bg-s-progress",
  expense_deleted: "bg-s-overdue",
  site_published: "bg-s-done",
  site_unpublished: "bg-n-400",
  maintenance_received: "bg-p-500",
  maintenance_updated: "bg-s-progress",
  maintenance_status: "bg-s-time",
  maintenance_deleted: "bg-s-overdue",
  quote_shared: "bg-p-500",
  quote_reviewed: "bg-s-time",
  quote_revoked: "bg-n-400",
}

/** "in progress" — statuses are stored snake_case but never shown that way. */
export function prettyState(value: string) {
  return value.replace(/_/g, " ")
}

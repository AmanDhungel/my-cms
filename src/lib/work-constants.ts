/**
 * Enums shared by the models, the validators and the UI. They live outside
 * `src/models` because importing a *value* from a model file drags mongoose
 * into the client bundle; importing a type from one does not.
 */

/**
 * The task lifecycle. "blocked" is a flag on work already under way rather
 * than a stage of its own, which is why the board shows four columns and
 * draws blocked cards inside "In progress".
 */
export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ["normal", "high", "critical"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** Radius the owner gets if they don't set one, in metres. */
export const DEFAULT_RADIUS_M = 50

export const CHECK_IN_TYPES = ["in", "out"] as const
export type CheckInType = (typeof CHECK_IN_TYPES)[number]

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "leave",
  "absent",
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

/**
 * "manual" is the employee pressing Start/End shift, "derived" comes from a
 * task check-in, and "auto" is the system closing a day at the end of the
 * shift because nobody closed it themselves.
 */
export const ATTENDANCE_SOURCES = ["manual", "derived", "auto"] as const
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number]

/** Minutes after shift start that still count as on time. */
export const LATE_GRACE_MIN = 10

export const REQUEST_KINDS = ["leave", "advance", "material"] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

export const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const PROJECT_STATUSES = ["active", "archived"] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const NOTIFICATION_KINDS = [
  "check_in",
  "check_out",
  "task_blocked",
  "task_in_review",
  "task_done",
  "task_assigned",
  "request_raised",
  "request_decided",
  "member_joined",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const MEMBER_STATUSES = ["active", "removed"] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

/** How long before a task starts that its check-in becomes available. */
export const CHECK_IN_OPENS_MIN = 10

/**
 * How an item is counted. Stock is meaningless without it — "12" of a cable
 * could be twelve reels or twelve metres.
 */
export const ITEM_UNITS = [
  "pcs",
  "box",
  "set",
  "pair",
  "kg",
  "g",
  "l",
  "m",
  "roll",
] as const
export type ItemUnit = (typeof ITEM_UNITS)[number]

/**
 * Where a bill's lines came from. A custom bill is typed by hand; an
 * inventory bill draws its lines — and its prices — from stock, and selling
 * one moves that stock.
 */
export const BILL_SOURCES = ["custom", "inventory"] as const
export type BillSource = (typeof BILL_SOURCES)[number]

/** A bill is never deleted. Voiding one puts any stock it took back. */
export const BILL_STATUSES = ["issued", "void"] as const
export type BillStatus = (typeof BILL_STATUSES)[number]

/**
 * How a bill was settled. "cheque" is its own state rather than a kind of
 * paid: the bill is handed over, but the money isn't in the bank until the
 * cheque clears. "quotation" is a price offered but not yet sold — it earns
 * nothing and, unlike the other three, takes nothing off the shelf.
 */
export const BILL_PAYMENTS = ["paid", "unpaid", "cheque", "quotation"] as const
export type BillPayment = (typeof BILL_PAYMENTS)[number]

/**
 * Which way the money went. "in" is money other people paid us, "out" is
 * money we paid a company or a person.
 */
export const PAYMENT_DIRECTIONS = ["in", "out"] as const
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number]

/** How it moved. A cheque or a transfer usually carries a reference. */
export const PAYMENT_METHODS = ["cash", "cheque", "bank", "online"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * How far from the office a shift may be opened without explanation.
 * A city GPS fix is easily tens of metres out, so there are two rings: inside
 * the first you are at the office, inside the second you are near enough that
 * nobody should be made to justify it, and beyond it a reason is required.
 */
export const OFFICE_RADIUS_M = 100
export const AWAY_RADIUS_M = 300

/** Where a shift was opened from, once measured against the office. */
export const SHIFT_PLACES = ["office", "near", "away"] as const
export type ShiftPlace = (typeof SHIFT_PLACES)[number]

/** Why someone is starting their day somewhere other than the office. */
export const AWAY_REASONS = [
  "wfh",
  "site_visit",
  "client_meeting",
  "field_work",
  "delivery",
  "travel",
  "training",
  "other",
] as const
export type AwayReason = (typeof AWAY_REASONS)[number]

/**
 * Everything the activity log records. A notification is addressed to someone
 * and deliberately skips the actor; a log entry is the opposite — one row per
 * event, including the owner's own, so the day can be read back as it happened.
 */
export const ACTIVITY_ACTIONS = [
  "task_created",
  "task_updated",
  "task_status",
  "task_checked_in",
  "task_checked_out",
  "project_created",
  "project_updated",
  "project_archived",
  "project_reopened",
  "shift_started",
  "shift_ended",
  "request_raised",
  "request_decided",
  "member_joined",
  "member_updated",
  "member_removed",
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

/** What an entry points at, so the log can link back to it. */
export const ACTIVITY_TARGETS = ["task", "project", "request", "member"] as const
export type ActivityTarget = (typeof ACTIVITY_TARGETS)[number]

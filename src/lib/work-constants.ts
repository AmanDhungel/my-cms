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
 * cheque clears.
 */
export const BILL_PAYMENTS = ["paid", "unpaid", "cheque"] as const
export type BillPayment = (typeof BILL_PAYMENTS)[number]

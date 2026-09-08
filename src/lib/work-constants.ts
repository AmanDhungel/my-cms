/**
 * Enums shared by the models, the validators and the UI. They live outside
 * `src/models` because importing a *value* from a model file drags mongoose
 * into the client bundle; importing a type from one does not.
 */

export const TASK_STATUSES = [
  "pending",
  "in_progress",
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

export const ATTENDANCE_SOURCES = ["manual", "derived"] as const
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
  "task_done",
  "task_assigned",
  "request_raised",
  "request_decided",
  "member_joined",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

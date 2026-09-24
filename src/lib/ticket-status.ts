/**
 * The ticket lifecycle from the EMS style guide. Every status carries a text
 * label because the guide is explicit that colour never travels alone — a
 * supervisor glancing at a phone in bright sun has to read it, not decode it.
 */
export const TICKET_STATUSES = [
  "pending",
  "progress",
  "material",
  "time",
  "done",
  "overdue",
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Pending",
  progress: "In progress",
  material: "Need material",
  time: "Need more time",
  done: "Completed",
  overdue: "Overdue",
}

/** Tailwind classes rather than raw hex, so the dots follow the theme tokens. */
export const TICKET_STATUS_DOT: Record<TicketStatus, string> = {
  pending: "bg-s-pending",
  progress: "bg-s-progress",
  material: "bg-s-material",
  time: "bg-s-time",
  done: "bg-s-done",
  overdue: "bg-s-overdue",
}

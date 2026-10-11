/**
 * Sales estimates (quotations): the rules, with no database or React.
 *
 * Stored statuses are Draft, Sent, Accepted, Declined and Converted.
 * "Expired" is never stored: it is read off the validity date — a Draft or
 * Sent estimate past its "valid until" day is expired, and extending the
 * date simply makes it current again. No job has to run for it.
 *
 * An estimate moves no stock, no money and no balance. Only the sale it is
 * converted into does.
 */

export const ESTIMATE_STATUSES = ["draft", "sent", "accepted", "declined", "converted"] as const
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number]
/** What a reader sees: the stored status, or "expired". */
export type EstimateState = EstimateStatus | "expired"

export const ESTIMATE_LABELS: Record<EstimateState, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  converted: "Converted",
  expired: "Expired",
}

/** How long a new estimate stays valid. */
export const DEFAULT_VALIDITY_DAYS = 15

/** "YYYY-MM-DD" plus whole days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Expired = still Draft or Sent after its last valid day. */
export function estimateState(status: EstimateStatus, validUntil: string, today: string): EstimateState {
  if ((status === "draft" || status === "sent") && validUntil < today) return "expired"
  return status
}

export type EstimateAction =
  | "edit"
  | "send"
  | "accept"
  | "decline"
  | "reopen"
  | "convert"
  | "delete"
  | "duplicate"

/** What can be done to an estimate in a given state. */
export function allowedActions(state: EstimateState): EstimateAction[] {
  switch (state) {
    case "draft":
      return ["edit", "send", "accept", "decline", "convert", "delete", "duplicate"]
    case "sent":
      return ["edit", "accept", "decline", "convert", "duplicate"]
    case "accepted":
      return ["edit", "decline", "convert", "duplicate"]
    // Declined and expired have to be reopened before anything else.
    case "declined":
    case "expired":
      return ["reopen", "duplicate"]
    case "converted":
      return ["duplicate"]
  }
}

export function canDo(state: EstimateState, action: EstimateAction) {
  return allowedActions(state).includes(action)
}

/** The stored status an action leaves behind. */
export function nextStatus(action: "send" | "accept" | "decline" | "reopen"): EstimateStatus {
  return { send: "sent", accept: "accepted", decline: "declined", reopen: "draft" }[action] as EstimateStatus
}

export function estimateNumber(seq: number) {
  return `EST-${String(seq).padStart(4, "0")}`
}

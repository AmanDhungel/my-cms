import type { BlockerReason } from "@/lib/work-constants"

/**
 * How a blocker reads on screen.
 *
 * Client-safe on purpose: the ticket model imports mongoose, and importing a
 * *value* from a model file drags it into the browser bundle — the same
 * reason the activity labels live apart from the activity writer.
 */
export const BLOCKER_LABELS: Record<BlockerReason, string> = {
  material: "waiting on material",
  equipment: "waiting on equipment",
  access: "can't get access",
  client: "waiting on the client",
  weather: "weather",
  permit: "waiting on a permit",
  payment: "waiting on payment",
  other: "something else",
}

/** Shorter, for a chip or a column. */
export const BLOCKER_SHORT: Record<BlockerReason, string> = {
  material: "Material",
  equipment: "Equipment",
  access: "Access",
  client: "Client",
  weather: "Weather",
  permit: "Permit",
  payment: "Payment",
  other: "Other",
}

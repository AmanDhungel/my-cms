import { z } from "zod"

import { saleCustomerSchema, saleLineSchema } from "@/lib/validations/sales"
import { BILL_SOURCES } from "@/lib/work-constants"

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

/**
 * A new or edited estimate. The same lines a sale takes — an inventory line's
 * price is read from stock on the server, as on a bill — plus how long it is
 * valid and its notes and terms.
 */
export const estimateSchema = z
  .object({
    source: z.enum(BILL_SOURCES),
    customerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Pick a party").optional(),
    customer: saleCustomerSchema,
    lines: z
      .array(saleLineSchema)
      .min(1, "Add at least one line")
      .max(60, "That is more lines than one estimate should carry"),
    withVat: z.boolean(),
    note: z.string().trim().max(1000, "That is a long note").optional(),
    /** The last day it is valid. Absent: 15 days from today. */
    validUntil: dayKey.optional(),
    /** Save it as Sent rather than Draft. */
    send: z.boolean().optional(),
  })
  .refine(
    (values) =>
      values.source === "custom" ||
      values.lines.every((line) => Boolean(line.itemId)),
    { message: "Every line has to be an inventory item", path: ["lines"] }
  )

export type EstimateValues = z.infer<typeof estimateSchema>

/** A change of status from the list or the estimate's page. */
export const estimateActionSchema = z.object({
  action: z.enum(["send", "accept", "decline", "reopen"]),
  /** On reopen: the new last valid day (default 15 days from today). */
  validUntil: dayKey.optional(),
})

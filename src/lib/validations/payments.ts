import { z } from "zod"

import { PAYMENT_DIRECTIONS, PAYMENT_METHODS } from "@/lib/work-constants"

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

export const paymentSchema = z
  .object({
    direction: z.enum(PAYMENT_DIRECTIONS),
    party: z
      .string()
      .trim()
      .min(2, "Who was it paid to, or paid by?")
      .max(140),
    amount: z.coerce
      .number<number>()
      .gt(0, "An amount has to be more than zero")
      .max(100_000_000, "That amount looks wrong"),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(60, "That reference is very long").optional(),
    note: z.string().trim().max(500).optional(),
    paidOn: dayKey,
    billId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Pick a bill from the list")
      .optional(),
    /** Marks the linked bill paid in the same write. */
    settleBill: z.boolean().optional(),
  })
  .refine((values) => values.direction === "in" || !values.billId, {
    message: "Only money you receive can be put against a bill",
    path: ["billId"],
  })
  .refine((values) => !values.settleBill || Boolean(values.billId), {
    message: "Pick the bill this settles",
    path: ["billId"],
  })

export type PaymentValues = z.infer<typeof paymentSchema>

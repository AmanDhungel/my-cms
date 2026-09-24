import { z } from "zod"

import { ACCOUNT_KINDS } from "@/lib/work-constants"

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

/** A bank account, a wallet, or the cash drawer. */
export const accountSchema = z.object({
  name: z.string().trim().min(2, "Give it a name").max(90),
  kind: z.enum(ACCOUNT_KINDS),
  reference: z
    .string()
    .trim()
    .max(60, "That reference is very long")
    .nullish()
    .transform((value) => value || undefined),
  detail: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((value) => value || undefined),
  /**
   * What was in it the day it was added here. Negative is allowed: an
   * overdrawn account is a real thing and refusing to record it would make
   * every balance after it wrong.
   */
  openingBalance: z.coerce
    .number<number>()
    .min(-100_000_000, "That balance looks wrong")
    .max(100_000_000, "That balance looks wrong"),
  openedOn: dayKey.nullish().transform((value) => value || undefined),
  isDefault: z.boolean().optional(),
})

export type AccountValues = z.infer<typeof accountSchema>

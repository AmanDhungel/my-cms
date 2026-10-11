import { z } from "zod"

/**
 * A split across accounts (lib/allocations.ts). Optional on every money
 * form: absent, the single `accountId` (or none, for cash) is what counts.
 * The checks that need the total — every part above zero, no account twice,
 * the parts adding up — are the server helper's, after the amount is known.
 */
export const allocationsField = z
  .array(
    z.object({
      accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Pick an account"),
      amount: z.coerce
        .number<number>()
        .max(100_000_000, "That amount looks wrong"),
    })
  )
  .max(20, "That is a lot of accounts for one payment")
  .optional()

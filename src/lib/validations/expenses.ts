import { z } from "zod"

import { EXPENSE_KINDS, PAYMENT_METHODS } from "@/lib/work-constants"

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Pick one from the list")

/** One item bought from a vendor, with what was paid for each. */
export const purchaseLineSchema = z.object({
  itemId: objectId,
  qty: z.coerce
    .number<number>()
    .gt(0, "A quantity has to be more than zero")
    .max(1_000_000, "That quantity looks wrong"),
  cost: z.coerce
    .number<number>()
    .min(0, "A cost can't be negative")
    .max(100_000_000, "That cost looks wrong"),
})

export const expenseSchema = z
  .object({
    kind: z.enum(EXPENSE_KINDS),
    payee: z.string().trim().min(2, "Who was it paid to?").max(140),
    /** Salary and commission name a person on the payroll. */
    employeeId: objectId.optional(),
    /** The supplier's own record, so this lands on their ledger. */
    partyId: objectId.optional(),
    /** Which bank, wallet or drawer it came out of. */
    accountId: objectId.optional(),
    /**
     * Ignored for a stock purchase, whose amount is the sum of its lines —
     * the server works that out so the two can never disagree.
     */
    amount: z.coerce
      .number<number>()
      .min(0, "An amount can't be negative")
      .max(100_000_000, "That amount looks wrong")
      .optional(),
    method: z.enum(PAYMENT_METHODS),
    reference: z
      .string()
      .trim()
      .max(60, "That reference is very long")
      .optional(),
    note: z.string().trim().max(500).optional(),
    spentOn: dayKey,
    lines: z.array(purchaseLineSchema).max(100, "That is a lot of lines"),
  })
  .refine((values) => values.kind !== "stock" || values.lines.length > 0, {
    message: "Add at least one item to the purchase",
    path: ["lines"],
  })
  .refine((values) => values.kind === "stock" || values.lines.length === 0, {
    message: "Only a stock purchase names items",
    path: ["lines"],
  })
  .refine(
    (values) => values.kind === "stock" || (values.amount ?? 0) > 0,
    {
      message: "An amount has to be more than zero",
      path: ["amount"],
    }
  )
  .refine(
    // One item twice on one purchase would make the average cost depend on
    // the order the lines were written in. One line per item, quantity added.
    (values) =>
      new Set(values.lines.map((line) => line.itemId)).size ===
      values.lines.length,
    {
      message: "That item is already on this purchase — change its quantity",
      path: ["lines"],
    }
  )

export type ExpenseValues = z.infer<typeof expenseSchema>

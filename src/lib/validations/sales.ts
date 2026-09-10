import { z } from "zod"

import { BILL_PAYMENTS, BILL_SOURCES } from "@/lib/work-constants"

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Pick an item")

/**
 * One line of a bill. The price is sent for a custom line but ignored for an
 * inventory line — the server reads that from stock, so a doctored request
 * can't sell a 8,000 rupee drill for 5.
 */
const lineSchema = z.object({
  itemId: objectId.optional(),
  name: z.string().trim().min(1, "Name what you are selling").max(140),
  unit: z.string().trim().max(16).optional(),
  price: z.coerce
    .number<number>()
    .min(0, "A price can't be negative")
    .max(100_000_000, "That price looks wrong"),
  qty: z.coerce
    .number<number>()
    .gt(0, "Quantity has to be more than zero")
    .max(1_000_000, "That is more than one bill can carry"),
  discountPct: z.coerce
    .number<number>()
    .min(0, "A discount can't be negative")
    .max(100, "100% is the largest discount"),
})

export const billSchema = z
  .object({
    source: z.enum(BILL_SOURCES),
    customer: z.object({
      name: z.string().trim().min(2, "Who is this bill for?").max(140),
      phone: z.string().trim().max(30).optional(),
      email: z
        .union([z.literal(""), z.email("That email doesn't look right")])
        .optional(),
      address: z.string().trim().max(200).optional(),
      pan: z.string().trim().max(30).optional(),
    }),
    lines: z
      .array(lineSchema)
      .min(1, "Add at least one line")
      .max(60, "That is more lines than one bill should carry"),
    /** Charges the workspace's saved rate; the bill snapshots it. */
    withVat: z.boolean(),
    // A bill nobody has settled is simply unpaid, so this may be left out.
    payment: z.enum(BILL_PAYMENTS).default("unpaid"),
    chequeNo: z
      .string()
      .trim()
      .max(40, "That is longer than a cheque number")
      .optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (values) =>
      values.source === "custom" ||
      values.lines.every((line) => Boolean(line.itemId)),
    { message: "Every line has to be an inventory item", path: ["lines"] }
  )

export type BillValues = z.infer<typeof billSchema>

/**
 * The two edits a bill allows: cancelling it, or settling it. Nothing else
 * about a raised bill can move — the money on it is a record.
 */
export const billUpdateSchema = z.union([
  z.object({ status: z.literal("void") }),
  z.object({
    payment: z.enum(BILL_PAYMENTS),
    chequeNo: z.string().trim().max(40).optional(),
  }),
])

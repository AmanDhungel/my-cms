import { z } from "zod"

import { ITEM_UNITS } from "@/lib/work-constants"

/** The "New category" dialog. */
export const categorySchema = z.object({
  name: z.string().trim().min(2, "Give the category a name").max(80),
  description: z.string().trim().max(500).optional(),
})

export type CategoryValues = z.infer<typeof categorySchema>

/**
 * The "New item" dialog. Stock lives on the item itself rather than in a
 * ledger of its own — the owner edits the number they counted on the shelf.
 */
export const itemSchema = z.object({
  name: z.string().trim().min(2, "Give the item a name").max(140),
  sku: z.string().trim().max(40).optional(),
  categoryId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Pick a category for this item"),
  description: z.string().trim().max(2000).optional(),
  unit: z.enum(ITEM_UNITS),
  // Decimals are allowed: 2.5 kg of something is a real amount.
  price: z.coerce
    .number<number>()
    .min(0, "A price can't be negative")
    .max(100_000_000, "That price looks wrong"),
  stock: z.coerce
    .number<number>()
    .min(0, "Stock can't be negative")
    .max(1_000_000, "That is more than this list can hold"),
  lowStockAt: z.coerce
    .number<number>()
    .min(0, "A threshold can't be negative")
    .max(1_000_000, "That threshold looks wrong"),
  location: z.string().trim().max(120).optional(),
})

export type ItemValues = z.infer<typeof itemSchema>

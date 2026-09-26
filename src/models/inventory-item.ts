import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { ITEM_UNITS, type ItemUnit } from "@/lib/work-constants"

export { ITEM_UNITS, type ItemUnit }

/**
 * One picture of an item. Both halves are kept: the URL is what a page
 * renders, the key is what the bucket is told to delete — deriving one from
 * the other later would tie the record to whatever public base was
 * configured on the day it was saved.
 */
const itemImageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
)

/** The most pictures an item holds. Checked in the form, the schema and here. */
export const MAX_ITEM_IMAGES = 3

const inventoryItemSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    /** The owner's own code for the item. Optional, but unique when given. */
    sku: { type: String, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 2000 },
    unit: { type: String, required: true, enum: ITEM_UNITS, default: "pcs" },
    /** Per unit, in the workspace's currency — no conversion is attempted. */
    price: { type: Number, required: true, min: 0, default: 0 },
    /**
     * What a unit costs us, averaged across every purchase recorded against
     * this item. Never typed by hand: it is recomputed from the purchase
     * ledger whenever one is recorded, edited or deleted, so it always agrees
     * with what is on record and a deleted purchase leaves no residue. Zero
     * means nothing has been bought through the expenses ledger yet.
     */
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    /** At or below this, the item is flagged as running out. */
    lowStockAt: { type: Number, required: true, min: 0, default: 0 },
    /** Where it is kept — a store room, a van, a shelf. */
    location: { type: String, trim: true, maxlength: 120 },
    /**
     * Up to three pictures, in the order they are shown; the first is the one
     * the stock list uses. Items saved before pictures existed load with an
     * empty list, which is the whole of the migration.
     */
    images: {
      type: [itemImageSchema],
      default: [],
      validate: {
        validator: (list: unknown[]) => list.length <= MAX_ITEM_IMAGES,
        message: "Three pictures is the most an item can hold",
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

inventoryItemSchema.index({ business: 1, name: 1 }, { unique: true })
// Partial, so the many items without a code don't all collide on `null`.
inventoryItemSchema.index(
  { business: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string" } } }
)
inventoryItemSchema.index({ business: 1, category: 1 })

export type InventoryItemDocument = InferSchemaType<typeof inventoryItemSchema>

export const InventoryItem: Model<InventoryItemDocument> =
  (models.InventoryItem as Model<InventoryItemDocument>) ??
  model<InventoryItemDocument>("InventoryItem", inventoryItemSchema)

export type ItemDTO = {
  id: string
  name: string
  sku: string | null
  description: string | null
  unit: ItemUnit
  price: number
  /** Averaged over every recorded purchase; 0 when none has been. */
  costPrice: number
  stock: number
  lowStockAt: number
  location: string | null
  /** In display order; empty for an item nobody has photographed. */
  images: { key: string; url: string }[]
  category: { id: string; name: string } | null
  createdAt: string
}

type MaybePopulated =
  | { _id: unknown; name?: string }
  | Schema.Types.ObjectId
  | null
  | undefined

/** The category is a plain id unless the query populated it. */
function named(ref: MaybePopulated) {
  if (!ref) return null
  if (typeof ref === "object" && "name" in ref) {
    return { id: String(ref._id), name: ref.name ?? "" }
  }
  return { id: String(ref), name: "" }
}

export function toItemDTO(
  item: HydratedDocument<InventoryItemDocument>
): ItemDTO {
  return {
    id: String(item._id),
    name: item.name,
    sku: item.sku ?? null,
    description: item.description ?? null,
    unit: item.unit as ItemUnit,
    price: item.price,
    costPrice: item.costPrice ?? 0,
    stock: item.stock,
    lowStockAt: item.lowStockAt,
    location: item.location ?? null,
    images: (item.images ?? []).map((one) => ({ key: one.key, url: one.url })),
    category: named(item.category as MaybePopulated),
    createdAt: (item.createdAt as Date).toISOString(),
  }
}

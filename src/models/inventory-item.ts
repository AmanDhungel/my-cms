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
    stock: { type: Number, required: true, min: 0, default: 0 },
    /** At or below this, the item is flagged as running out. */
    lowStockAt: { type: Number, required: true, min: 0, default: 0 },
    /** Where it is kept — a store room, a van, a shelf. */
    location: { type: String, trim: true, maxlength: 120 },
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
  stock: number
  lowStockAt: number
  location: string | null
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
    stock: item.stock,
    lowStockAt: item.lowStockAt,
    location: item.location ?? null,
    category: named(item.category as MaybePopulated),
    createdAt: (item.createdAt as Date).toISOString(),
  }
}

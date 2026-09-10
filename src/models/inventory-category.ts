import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

const inventoryCategorySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// One name per workspace, so "Cables" can't quietly exist twice.
inventoryCategorySchema.index({ business: 1, name: 1 }, { unique: true })

export type InventoryCategoryDocument = InferSchemaType<
  typeof inventoryCategorySchema
>

export const InventoryCategory: Model<InventoryCategoryDocument> =
  (models.InventoryCategory as Model<InventoryCategoryDocument>) ??
  model<InventoryCategoryDocument>(
    "InventoryCategory",
    inventoryCategorySchema
  )

export type CategoryDTO = {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export function toCategoryDTO(
  category: HydratedDocument<InventoryCategoryDocument>
): CategoryDTO {
  return {
    id: String(category._id),
    name: category.name,
    description: category.description ?? null,
    createdAt: (category.createdAt as Date).toISOString(),
  }
}

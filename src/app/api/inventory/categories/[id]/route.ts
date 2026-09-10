import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { sameText } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { categorySchema } from "@/lib/validations/inventory"
import {
  InventoryCategory,
  toCategoryDTO,
} from "@/models/inventory-category"
import { InventoryItem } from "@/models/inventory-item"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/inventory/categories/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = categorySchema.parse(await request.json())

    await connectToDatabase()

    const category = await InventoryCategory.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!category) throw new HttpError(404, "That category doesn't exist")

    const clash = await InventoryCategory.findOne({
      _id: { $ne: category._id },
      business: viewer.businessId,
      name: sameText(values.name),
    })

    if (clash) {
      throw new HttpError(409, `${clash.name} already exists`)
    }

    category.name = values.name
    category.description = values.description
    await category.save()

    return ok({ category: toCategoryDTO(category) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * A category is only removable once it is empty — deleting one that still
 * holds items would leave those items pointing at nothing.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/inventory/categories/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()

    const category = await InventoryCategory.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!category) throw new HttpError(404, "That category doesn't exist")

    const held = await InventoryItem.countDocuments({ category: category._id })

    if (held > 0) {
      throw new HttpError(
        409,
        `${held} item${held === 1 ? " is" : "s are"} still in ${category.name}. Move or delete ${held === 1 ? "it" : "them"} first.`
      )
    }

    await category.deleteOne()

    return ok({ id: String(category._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

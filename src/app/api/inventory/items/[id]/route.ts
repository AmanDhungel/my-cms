import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { assertItemIsNew } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { itemSchema } from "@/lib/validations/inventory"
import { InventoryCategory } from "@/models/inventory-category"
import { InventoryItem, toItemDTO } from "@/models/inventory-item"

export const runtime = "nodejs"

/** Edit an item, including the stock count and where it is kept. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/inventory/items/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = itemSchema.parse(await request.json())

    await connectToDatabase()

    const item = await InventoryItem.findOne({
      _id: id,
      business: viewer.businessId,
    })

    if (!item) throw new HttpError(404, "That item doesn't exist")

    const category = await InventoryCategory.findOne({
      _id: values.categoryId,
      business: viewer.businessId,
    })

    if (!category) throw new HttpError(404, "That category doesn't exist")

    await assertItemIsNew(
      viewer.businessId,
      values.name,
      values.sku,
      String(item._id)
    )

    item.category = category._id
    item.name = values.name
    item.sku = values.sku
    item.description = values.description
    item.unit = values.unit
    item.price = values.price
    item.stock = values.stock
    item.lowStockAt = values.lowStockAt
    item.location = values.location
    await item.save()

    await item.populate("category", "name")

    return ok({ item: toItemDTO(item) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Items carry no history of their own — nothing else points at one — so this
 * is a real delete rather than the soft removal people and projects get.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/inventory/items/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()

    const item = await InventoryItem.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!item) throw new HttpError(404, "That item doesn't exist")

    return ok({ id: String(item._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

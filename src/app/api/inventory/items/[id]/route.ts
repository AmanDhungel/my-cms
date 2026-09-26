import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { assertItemIsNew, itemImagesFrom } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { deleteUploads, reconcileUploads } from "@/lib/s3"
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

    // Pictures only change when the body says so; what they were, so the
    // ones dropped can be cleared out once the save has landed.
    const before = (item.images ?? []).map((one) => one.url)
    if (values.images !== undefined) {
      item.set("images", itemImagesFrom(values.images, viewer.businessId))
    }
    await item.save()

    /*
     * Only now, with the record pointing at the new list, are replaced or
     * removed objects deleted — a refused save never costs a picture. Not
     * awaited: a bucket that refuses a delete must not fail the edit.
     */
    if (values.images !== undefined) {
      void reconcileUploads(
        before,
        (item.images ?? []).map((one) => one.url)
      )
    }

    await item.populate("category", "name")

    return ok({ item: toItemDTO(item) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * A real delete rather than the soft removal people and projects get. Bills,
 * purchases and tickets that named the item keep their own copy of its name,
 * so they read the same afterwards. Its pictures go with it.
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

    // After the row is gone, so a failed delete never loses the pictures.
    const urls = (item.images ?? []).map((one) => one.url)
    if (urls.length > 0) void deleteUploads(urls)

    return ok({ id: String(item._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

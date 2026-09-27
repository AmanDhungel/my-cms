import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole, requireUser } from "@/lib/auth/guards"
import { assertItemIsNew, itemImagesFrom } from "@/lib/inventory"
import { assertCanDeleteRecord, assertCanRemoveImages } from "@/lib/auth/permissions"
import { connectToDatabase } from "@/lib/mongodb"
import { deleteUploads, keyFromUrl } from "@/lib/s3"
import { itemSchema } from "@/lib/validations/inventory"
import { InventoryCategory } from "@/models/inventory-category"
import { InventoryItem, toItemDTO } from "@/models/inventory-item"

export const runtime = "nodejs"

/**
 * The pictures no other item of this business still points at.
 *
 * Items can only reference their own business's product pictures, but two
 * items can still share one (a copied URL through the API). Deleting a
 * picture because one of them let go of it would break the other.
 */
async function onlyHere(urls: string[], businessId: string, itemId: string) {
  if (urls.length === 0) return []
  // By key: the same object may be stored under an old bucket link on one
  // item and its CDN address on another.
  const keys = urls.map((url) => keyFromUrl(url)).filter((key): key is string => Boolean(key))
  const others = await InventoryItem.find({
    business: businessId,
    _id: { $ne: itemId },
    "images.key": { $in: keys },
  })
    .select("images.key")
    .lean()
  const shared = new Set(
    others.flatMap((one) => (one.images ?? []).map((image) => image.key))
  )
  return urls.filter((url) => !shared.has(keyFromUrl(url) ?? ""))
}

/** Edit an item, including the stock count and where it is kept. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/inventory/items/[id]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = itemSchema.parse(await readJson(request))

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
      const next = itemImagesFrom(values.images, viewer.businessId, viewer.id, item.images ?? [])
      // Dropping or replacing a saved picture is deleting it: each one has
      // to be the viewer's to delete (lib/auth/permissions.ts), or nothing
      // is saved.
      // Compared by key: a kept picture may come back under its CDN address.
      const keep = new Set(next.map((one) => one.key))
      assertCanRemoveImages(
        viewer,
        (item.images ?? [])
          .filter((one) => !keep.has(one.key))
          .map((one) => ({ uploadedBy: one.uploadedBy ? String(one.uploadedBy) : null }))
      )
      item.set("images", next)
    }
    await item.save()

    /*
     * Only now, with the record pointing at the new list, are replaced or
     * removed objects deleted — a refused save never costs a picture. Not
     * awaited: a bucket that refuses a delete must not fail the edit.
     */
    if (values.images !== undefined) {
      const kept = new Set((item.images ?? []).map((one) => one.key))
      const dropped = before.filter((url) => !kept.has(keyFromUrl(url) ?? ""))
      void onlyHere(dropped, viewer.businessId, String(item._id))
        .then((urls) => deleteUploads(urls, viewer.businessId))
        .catch(() => undefined)
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
    const viewer = await requireUser()
    // Deleting a record is the owner's alone (lib/auth/permissions.ts).
    assertCanDeleteRecord(viewer)
    const { id } = await ctx.params

    await connectToDatabase()

    const item = await InventoryItem.findOneAndDelete({
      _id: id,
      business: viewer.businessId,
    })

    if (!item) throw new HttpError(404, "That item doesn't exist")

    // After the row is gone, so a failed delete never loses the pictures.
    const urls = (item.images ?? []).map((one) => one.url)
    if (urls.length > 0) {
      void onlyHere(urls, viewer.businessId, String(item._id))
        .then((own) => deleteUploads(own, viewer.businessId))
        .catch(() => undefined)
    }

    // Audit trail: every delete is recorded (never any secret).
    void logActivity({
      businessId: viewer.businessId,
      action: "record_deleted",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: item.name,
      detail: "inventory item",
    })
    return ok({ id: String(item._id) })
  } catch (error) {
    return handleApiError(error)
  }
}

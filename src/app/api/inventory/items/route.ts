import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { assertItemIsNew } from "@/lib/inventory"
import { connectToDatabase } from "@/lib/mongodb"
import { itemSchema } from "@/lib/validations/inventory"
import { InventoryCategory } from "@/models/inventory-category"
import { InventoryItem, toItemDTO } from "@/models/inventory-item"

export const runtime = "nodejs"

/**
 * Every item in the workspace, with its category name attached. The list is
 * small enough to hand over whole — searching and filtering happen on the
 * page, so typing in the search box doesn't hit the server on every key.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const items = await InventoryItem.find({ business: viewer.businessId })
      .populate("category", "name")
      .sort({ name: 1 })
      .limit(500)

    return ok({ items: items.map(toItemDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = itemSchema.parse(await request.json())

    await connectToDatabase()

    // The category has to be one of this workspace's own.
    const category = await InventoryCategory.findOne({
      _id: values.categoryId,
      business: viewer.businessId,
    })

    if (!category) throw new HttpError(404, "That category doesn't exist")

    await assertItemIsNew(viewer.businessId, values.name, values.sku)

    const item = await InventoryItem.create({
      business: viewer.businessId,
      category: category._id,
      name: values.name,
      sku: values.sku,
      description: values.description,
      unit: values.unit,
      price: values.price,
      stock: values.stock,
      lowStockAt: values.lowStockAt,
      location: values.location,
      createdBy: viewer.id,
    })

    await item.populate("category", "name")

    return ok({ item: toItemDTO(item) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

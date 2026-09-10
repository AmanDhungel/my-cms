import { handleApiError, ok, HttpError } from "@/lib/api-response"
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

/**
 * Item categories, each with the number of items filed under it. Inventory is
 * an owner-and-supervisor page, so the crew never reads this.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const categories = await InventoryCategory.find({
      business: viewer.businessId,
    })
      .sort({ name: 1 })
      .limit(200)

    // One grouped query rather than a count per category.
    const grouped = await InventoryItem.aggregate<{ _id: unknown; n: number }>([
      { $match: { category: { $in: categories.map((c) => c._id) } } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
    ])

    const counts = new Map(grouped.map((row) => [String(row._id), row.n]))

    return ok({
      categories: categories.map((category) => ({
        ...toCategoryDTO(category),
        items: counts.get(String(category._id)) ?? 0,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = categorySchema.parse(await request.json())

    await connectToDatabase()

    const clash = await InventoryCategory.findOne({
      business: viewer.businessId,
      name: sameText(values.name),
    })

    if (clash) {
      throw new HttpError(409, `${clash.name} already exists`)
    }

    const category = await InventoryCategory.create({
      business: viewer.businessId,
      name: values.name,
      description: values.description,
      createdBy: viewer.id,
    })

    return ok({ category: toCategoryDTO(category) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

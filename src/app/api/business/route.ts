import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { businessSettingsSchema } from "@/lib/validations/auth"
import { Business, toBusinessDTO } from "@/models/business"

export const runtime = "nodejs"

/** Owner-only. The workspace a member belongs to is fixed by their session. */
export async function PATCH(request: Request) {
  try {
    const owner = await requireRole("owner")
    const values = businessSettingsSchema.parse(await request.json())

    await connectToDatabase()

    const business = await Business.findByIdAndUpdate(
      owner.businessId,
      { $set: { name: values.name, crewSize: values.crewSize } },
      { new: true, runValidators: true }
    ).orFail()

    return ok({ business: toBusinessDTO(business) })
  } catch (error) {
    return handleApiError(error)
  }
}

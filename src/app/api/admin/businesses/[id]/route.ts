import { z } from "zod"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Business, toBusinessDTO } from "@/models/business"

export const runtime = "nodejs"

const blockSchema = z.object({ blocked: z.boolean() })

/**
 * Block or unblock a whole workspace. Nothing is written to its members: the
 * guards read the workspace alongside the account on every request, so one
 * write here shuts out owner, supervisor and crew alike, at once.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/businesses/[id]">
) {
  try {
    await requireSuperAdmin()
    const { id } = await ctx.params
    const { blocked } = blockSchema.parse(await request.json())

    await connectToDatabase()

    const business = await Business.findById(id)
    if (!business) throw new HttpError(404, "That workspace doesn't exist")

    if (blocked) {
      business.blockedAt = new Date()
    } else {
      business.set("blockedAt", undefined)
    }
    await business.save()

    return ok({ business: toBusinessDTO(business) })
  } catch (error) {
    return handleApiError(error)
  }
}

import { z } from "zod"

import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { revokeMobileAccess } from "@/lib/auth/mobile-sessions"
import { connectToDatabase } from "@/lib/mongodb"
import { Business, toBusinessDTO } from "@/models/business"
import { User } from "@/models/user"

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
    const { blocked } = blockSchema.parse(await readJson(request))

    await connectToDatabase()

    const business = await Business.findById(id)
    if (!business) throw new HttpError(404, "That workspace doesn't exist")

    if (blocked) {
      business.blockedAt = new Date()
    } else {
      business.set("blockedAt", undefined)
    }
    await business.save()
    // Blocking the workspace ends every member's mobile tokens at once.
    if (blocked) {
      const members = await User.find({ business: business._id }).select("_id").lean()
      await revokeMobileAccess(members.map((member) => member._id))
    }

    return ok({ business: toBusinessDTO(business) })
  } catch (error) {
    return handleApiError(error)
  }
}

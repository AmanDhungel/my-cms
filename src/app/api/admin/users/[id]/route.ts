import { z } from "zod"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { connectToDatabase } from "@/lib/mongodb"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

const blockSchema = z.object({ blocked: z.boolean() })

/**
 * Block or unblock one account. A blocked account is refused at sign-in and
 * at every guard, but keeps its row — the work it did stays attributable.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/users/[id]">
) {
  try {
    await requireSuperAdmin()
    const { id } = await ctx.params
    const { blocked } = blockSchema.parse(await request.json())

    await connectToDatabase()

    const user = await User.findById(id)
    if (!user) throw new HttpError(404, "That account doesn't exist")

    // Blocking a super admin would lock the last door from the inside.
    if (blocked && isSuperAdmin(user.email)) {
      throw new HttpError(409, "A super admin can't be blocked")
    }

    if (blocked) {
      user.blockedAt = new Date()
    } else {
      user.set("blockedAt", undefined)
    }
    await user.save()

    return ok({ user: toUserDTO(user) })
  } catch (error) {
    return handleApiError(error)
  }
}

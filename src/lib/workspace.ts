import { HttpError } from "@/lib/api-response"
import { rememberedWorkspace } from "@/lib/auth/membership"
import { Business } from "@/models/business"

/**
 * The workspace behind a session, with the zone every date rule depends on.
 *
 * Pass the viewer a guard returned and it is the workspace the guard already
 * read in this request — no second round trip. An id reads it fresh.
 */
export async function getWorkspace(who: string | { businessId: string }) {
  if (typeof who !== "string") {
    const remembered = rememberedWorkspace(who)
    if (remembered) return remembered
  }
  const businessId = typeof who === "string" ? who : who.businessId
  const business = await Business.findById(businessId)

  if (!business) {
    throw new HttpError(404, "That workspace no longer exists")
  }

  return business
}

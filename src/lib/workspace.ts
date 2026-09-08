import { HttpError } from "@/lib/api-response"
import { Business } from "@/models/business"

/** The workspace behind a session, with the zone every date rule depends on. */
export async function getWorkspace(businessId: string) {
  const business = await Business.findById(businessId)

  if (!business) {
    throw new HttpError(404, "That workspace no longer exists")
  }

  return business
}

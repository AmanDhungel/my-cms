import { handleApiError, ok } from "@/lib/api-response"
import { findPendingInvite } from "@/lib/auth/invites"

export const runtime = "nodejs"

/** Public. Lets /join/[token] show who the invite is for before signing up. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/invites/[token]">
) {
  try {
    const { token } = await ctx.params
    return ok({ invite: await findPendingInvite(token) })
  } catch (error) {
    return handleApiError(error)
  }
}

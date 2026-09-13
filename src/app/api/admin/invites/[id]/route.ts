import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { WorkspaceInvite, toWorkspaceInviteDTO } from "@/models/workspace-invite"

export const runtime = "nodejs"

/**
 * Revokes an invite that hasn't been used. The row stays, so the record of
 * who was offered a workspace and when survives the link being cancelled.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/invites/[id]">
) {
  try {
    await requireSuperAdmin()
    const { id } = await ctx.params

    await connectToDatabase()

    const invite = await WorkspaceInvite.findById(id)
    if (!invite) throw new HttpError(404, "That invite doesn't exist")

    // A spent invite is history; there is nothing left to take back.
    if (invite.acceptedAt) {
      throw new HttpError(409, "That invite has already been used")
    }

    invite.revokedAt = new Date()
    await invite.save()

    return ok({ invite: toWorkspaceInviteDTO(invite) })
  } catch (error) {
    return handleApiError(error)
  }
}

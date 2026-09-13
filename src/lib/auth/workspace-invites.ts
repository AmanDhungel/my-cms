import { HttpError } from "@/lib/api-response"
import { connectToDatabase } from "@/lib/mongodb"
import { hashInviteToken } from "@/models/invite"
import { WorkspaceInvite } from "@/models/workspace-invite"

export type PendingWorkspaceInvite = {
  id: string
  /** When set, the sign-up form is locked to this address. */
  email: string | null
  businessName: string | null
  note: string | null
  expiresAt: string
}

/**
 * Resolves a raw sign-up token to a still-usable invite. Every failure reads
 * the same to the caller — spent, revoked, expired and never-existed are one
 * answer, so a token can't be probed for near-misses.
 */
export async function findPendingWorkspaceInvite(
  token: string
): Promise<PendingWorkspaceInvite> {
  await connectToDatabase()

  const invite = await WorkspaceInvite.findOne({
    tokenHash: hashInviteToken(token),
  })

  if (
    !invite ||
    invite.acceptedAt ||
    invite.revokedAt ||
    invite.expiresAt.getTime() < Date.now()
  ) {
    throw new HttpError(404, "That invite link is no longer valid")
  }

  return {
    id: String(invite._id),
    email: invite.email ?? null,
    businessName: invite.businessName ?? null,
    note: invite.note ?? null,
    expiresAt: invite.expiresAt.toISOString(),
  }
}

import { HttpError } from "@/lib/api-response"
import { connectToDatabase } from "@/lib/mongodb"
import { Business } from "@/models/business"
import { Invite, hashInviteToken, type InviteRole } from "@/models/invite"

export type PendingInvite = {
  id: string
  name: string
  email: string
  phone: string
  role: InviteRole
  shift: string
  message: string | null
  businessId: string
  businessName: string
  expiresAt: string
}

/**
 * Resolves a raw join token to a still-usable invite. Every failure reads the
 * same to the caller so a token can't be probed for near-misses.
 */
export async function findPendingInvite(
  token: string
): Promise<PendingInvite> {
  await connectToDatabase()

  const invite = await Invite.findOne({ tokenHash: hashInviteToken(token) })

  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(404, "That invite link is no longer valid")
  }

  const business = await Business.findById(invite.business)

  if (!business) {
    throw new HttpError(404, "That invite link is no longer valid")
  }

  return {
    id: String(invite._id),
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    role: invite.role,
    shift: invite.shift,
    message: invite.message ?? null,
    businessId: String(invite.business),
    businessName: business.name,
    expiresAt: invite.expiresAt.toISOString(),
  }
}

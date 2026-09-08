import type { NextRequest } from "next/server"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { inviteSchema } from "@/lib/validations/auth"
import {
  INVITE_TTL_MS,
  Invite,
  createInviteToken,
  toInviteDTO,
} from "@/models/invite"
import { User } from "@/models/user"

export const runtime = "nodejs"

/** Live invites for the owner's workspace, newest first. */
export async function GET() {
  try {
    const owner = await requireRole("owner")
    await connectToDatabase()

    const invites = await Invite.find({
      business: owner.businessId,
      acceptedAt: { $exists: false },
    }).sort({ createdAt: -1 })

    return ok({ invites: invites.map(toInviteDTO) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * The only route that can create a crew account. The raw token is returned
 * exactly once — only its hash is stored, so it can never be read back.
 */
export async function POST(request: NextRequest) {
  try {
    const owner = await requireRole("owner")
    const values = inviteSchema.parse(await request.json())
    const email = values.email.toLowerCase()

    await connectToDatabase()

    if (await User.exists({ email })) {
      return fail("Someone already signs in with that email", 409, {
        email: ["Someone already signs in with that email"],
      })
    }

    // Replace any unaccepted invite for this email so a re-invite reissues
    // the link instead of tripping the one-live-invite index.
    await Invite.deleteOne({
      business: owner.businessId,
      email,
      acceptedAt: { $exists: false },
    })

    const { token, tokenHash } = createInviteToken()

    const invite = await Invite.create({
      business: owner.businessId,
      name: values.name,
      email,
      phone: values.phone,
      role: values.role,
      shift: values.shift,
      message: values.message,
      tokenHash,
      invitedBy: owner.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })

    return ok(
      {
        invite: toInviteDTO(invite),
        // Hand this to the invitee. It is not recoverable afterwards.
        joinUrl: new URL(`/join/${token}`, request.nextUrl.origin).toString(),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}

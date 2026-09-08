import { Types } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { findPendingInvite } from "@/lib/auth/invites"
import { hashPassword } from "@/lib/auth/password"
import { connectToDatabase } from "@/lib/mongodb"
import { notifySupervisors } from "@/lib/notify"
import { acceptInviteSchema } from "@/lib/validations/auth"
import { Invite } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

/**
 * Public, but only reachable with a valid token — this is how every
 * non-owner account comes into existence.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/invites/[token]/accept">
) {
  try {
    const { token } = await ctx.params
    const values = acceptInviteSchema.parse(await request.json())
    const invite = await findPendingInvite(token)

    const connection = await connectToDatabase()

    if (await User.exists({ email: invite.email })) {
      throw new HttpError(409, "That email already has an account")
    }

    const userId = new Types.ObjectId()
    const passwordHash = await hashPassword(values.password)
    const session = await connection.startSession()

    try {
      await session.withTransaction(async () => {
        // Claim the invite first: a second request racing this one finds
        // nothing to modify and the whole transaction rolls back.
        const claimed = await Invite.updateOne(
          { _id: invite.id, acceptedAt: { $exists: false } },
          { $set: { acceptedAt: new Date(), acceptedBy: userId } },
          { session }
        )

        if (claimed.modifiedCount !== 1) {
          throw new HttpError(409, "That invite has already been used")
        }

        await User.create(
          [
            {
              _id: userId,
              name: invite.name,
              email: invite.email,
              phone: invite.phone,
              passwordHash,
              role: invite.role,
              business: invite.businessId,
              shift: invite.shift,
            },
          ],
          { session }
        )
      })
    } finally {
      await session.endSession()
    }

    const user = await User.findById(userId).orFail()

    await notifySupervisors({
      businessId: invite.businessId,
      kind: "member_joined",
      title: `${invite.name} joined the workspace`,
      body: `${invite.role} · shift ${invite.shift}`,
      href: "/dashboard/people",
    })

    return ok({ user: toUserDTO(user) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

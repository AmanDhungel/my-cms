import { createHash, timingSafeEqual } from "node:crypto"
import { Types } from "mongoose"

import { hashPassword } from "@/lib/auth/password"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { isSuperAdmin, SUPER_ADMIN_ADDRESS_MESSAGE } from "@/lib/auth/super-admin"
import { connectToDatabase } from "@/lib/mongodb"
import { signupSchema } from "@/lib/validations/auth"
import { Business, toBusinessDTO } from "@/models/business"
import { hashInviteToken } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"
import { WorkspaceInvite } from "@/models/workspace-invite"
import { enforceLimit } from "@/lib/security/rate-limit"
import { clientIp } from "@/lib/security/client-ip"

export const runtime = "nodejs"

/**
 * Whether a request carries this deployment's bootstrap token. Unset means
 * nobody can open a workspace without an invite. Compared as digests so the
 * time taken says nothing about how much of it was right.
 */
function isBootstrapToken(sent: string | undefined) {
  const expected = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN
  if (!expected || !sent) return false
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(sent), digest(expected))
}

/**
 * Creates a workspace and its owner — but only against a live invite from a
 * super admin. There is no open sign-up: every account in the system traces
 * back either to one of these or to a workspace's own /join/[token].
 *
 * The single exception is the deployment's own administrator opening the
 * first workspace, since otherwise there would be nobody to issue invites.
 */
export async function POST(request: Request) {
  try {
    // Opening workspaces is limited per IP (lib/security/limits.ts).
    await enforceLimit("register", clientIp(request.headers))
    // Validate before touching the database so bad payloads cost nothing.
    const values = signupSchema.parse(await readJson(request))

    const connection = await connectToDatabase()
    const email = values.email.toLowerCase()

    /**
     * The one way in without an invite: the address that administers this
     * deployment. Somebody has to be able to open the first workspace, and
     * the environment — not the database — decides who that is.
     */
    const bootstrapping =
      !values.invite && isSuperAdmin(email) && isBootstrapToken(values.bootstrapToken)

    if (!values.invite && !bootstrapping) {
      throw new HttpError(403, "Opening a workspace needs an invite link")
    }

    // Knowing the administrator's address is not enough to become them: an
    // invite (addressed or open) can never create that account.
    if (!bootstrapping && isSuperAdmin(email)) {
      throw new HttpError(403, SUPER_ADMIN_ADDRESS_MESSAGE)
    }

    const invite = values.invite
      ? await WorkspaceInvite.findOne({
          tokenHash: hashInviteToken(values.invite),
        })
      : null

    if (!bootstrapping) {
      // Spent, revoked, expired and never-existed all read the same, so a
      // token can't be probed for near-misses.
      if (
        !invite ||
        invite.acceptedAt ||
        invite.revokedAt ||
        invite.expiresAt.getTime() < Date.now()
      ) {
        throw new HttpError(404, "That invite link is no longer valid")
      }

      // An invite addressed to someone is for them alone.
      if (invite.email && invite.email !== email) {
        throw new HttpError(
          409,
          `That invite is for ${invite.email}. Sign up with that address, or ask for your own link.`
        )
      }
    }

    const session = await connection.startSession()

    // Both documents reference each other, so the ids are minted up front.
    const businessId = new Types.ObjectId()
    const ownerId = new Types.ObjectId()
    const passwordHash = await hashPassword(values.password)

    try {
      await session.withTransaction(async () => {
        // Claiming the invite first is what makes it single-use: two people
        // opening the same link race here, and only one write matches.
        if (invite) {
          const claimed = await WorkspaceInvite.findOneAndUpdate(
            {
              _id: invite._id,
              acceptedAt: { $exists: false },
              revokedAt: { $exists: false },
            },
            {
              $set: {
                acceptedAt: new Date(),
                acceptedBy: ownerId,
                business: businessId,
              },
            },
            { new: true, session }
          )

          if (!claimed) {
            throw new HttpError(409, "That invite link has already been used")
          }
        }

        await User.create(
          [
            {
              _id: ownerId,
              name: values.name,
              email,
              phone: values.phone,
              passwordHash,
              role: "owner",
              business: businessId,
            },
          ],
          { session }
        )

        await Business.create(
          [
            {
              _id: businessId,
              name: values.business,
              crewSize: values.crewSize,
              // The rings take their defaults; settings tunes them later.
              office: values.office,
              owner: ownerId,
            },
          ],
          { session }
        )
      })
    } finally {
      await session.endSession()
    }

    const [owner, business] = await Promise.all([
      User.findById(ownerId).orFail(),
      Business.findById(businessId).orFail(),
    ])

    return ok({ user: toUserDTO(owner), business: toBusinessDTO(business) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

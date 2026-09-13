import { auth } from "@/auth"
import { HttpError } from "@/lib/api-response"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { connectToDatabase } from "@/lib/mongodb"
import { User, type UserRole } from "@/models/user"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  businessId: string
}

/**
 * Any signed-in member, re-checked against the database.
 *
 * The session is a JWT, so it keeps asserting whatever was true at sign-in.
 * Someone removed from the workspace — or moved to another one — would carry a
 * valid token for the rest of its life, so membership is confirmed on every
 * request rather than trusted from the claims.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  const claims = session?.user

  if (!claims?.id) {
    throw new HttpError(401, "Sign in to continue")
  }

  await connectToDatabase()

  // The workspace comes along so a blocked one shuts out everyone in it —
  // the second query is the price of a block that takes effect at once
  // rather than whenever a cascade last ran.
  const member = await User.findById(claims.id)
    .select("name email role business status blockedAt")
    .populate<{ business: { _id: unknown; blockedAt?: Date } }>(
      "business",
      "blockedAt"
    )

  if (!member || member.status === "removed") {
    throw new HttpError(403, "You are no longer part of this workspace")
  }

  if (member.blockedAt || member.business?.blockedAt) {
    throw new HttpError(403, "This account has been blocked")
  }

  return {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    // Read from the row, not the token: an account that moved workspaces must
    // not keep reaching the old one's data. `_id` because the workspace was
    // populated for the block check above.
    businessId: String(member.business._id),
  }
}

/** A member holding one of `roles`. Throws 403 for everyone else. */
export async function requireRole(
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const user = await requireUser()

  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You don't have access to that")
  }

  return user
}

export type SuperAdmin = { id: string; name: string; email: string }

/**
 * The guard for everything under /api/admin. The email is re-read from the
 * database on every request, so a token minted before an account was renamed
 * can't carry an old address in.
 *
 * Deliberately blind to blocked and removed status: the admin area is how a
 * block gets undone, and it has to stay reachable after a mistake.
 */
export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new HttpError(401, "Sign in to continue")
  }

  await connectToDatabase()

  const member = await User.findById(session.user.id).select("name email")

  if (!member || !isSuperAdmin(member.email)) {
    throw new HttpError(403, "You don't have access to that")
  }

  return {
    id: String(member._id),
    name: member.name,
    email: member.email,
  }
}

import { auth } from "@/auth"
import { HttpError } from "@/lib/api-response"
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

  const member = await User.findById(claims.id).select(
    "name email role business status"
  )

  if (!member || member.status === "removed") {
    throw new HttpError(403, "You are no longer part of this workspace")
  }

  return {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    // Read from the row, not the token: an account that moved workspaces must
    // not keep reaching the old one's data.
    businessId: String(member.business),
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

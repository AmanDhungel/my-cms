import { headers } from "next/headers"

import { auth } from "@/auth"
import { HttpError } from "@/lib/api-response"
import { loadMembership, rememberWorkspace } from "@/lib/auth/membership"
import { bearerToken, hasBearer, verifyAccessToken } from "@/lib/auth/mobile-tokens"
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
  const claims = await readClaims()

  if (!claims?.id) {
    throw new HttpError(401, "Sign in to continue")
  }

  await connectToDatabase()

  // The workspace comes along so a blocked one shuts out everyone in it,
  // at once rather than whenever a cascade last ran. One round trip for
  // both (lib/auth/membership.ts); the route reuses the workspace.
  const found = await loadMembership(claims.id)
  const member = found?.member
  const business = found?.business

  if (!member || member.status === "removed") {
    throw new HttpError(403, "You are no longer part of this workspace")
  }

  if (member.blockedAt || business?.blockedAt) {
    throw new HttpError(403, "This account has been blocked")
  }

  if (!business) {
    throw new Error("The account's workspace no longer exists")
  }

  if (isStaleSession(claims.signedInAt, member.sessionsValidAfter)) {
    throw new HttpError(401, "Sign in to continue")
  }

  // A mobile token minted before the account's last revocation (block,
  // role change, removal, password change, log-out-everywhere) is spent.
  if (claims.via === "bearer" && claims.tokenVersion !== (member.tokenVersion ?? 0)) {
    throw new HttpError(401, "Sign in to continue")
  }

  const viewer: SessionUser = {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    // Read from the row, not the token: an account that moved workspaces must
    // not keep reaching the old one's data.
    businessId: String(business._id),
  }
  rememberWorkspace(viewer, business)
  return viewer
}

type Claims = {
  id: string
  /** ms since the epoch; checked against sessionsValidAfter. */
  signedInAt?: number
} & ({ via: "cookie" } | { via: "bearer"; tokenVersion: number })

/**
 * Who the request says it is — by one route only.
 *
 * With `Authorization: Bearer …` the mobile access token is the whole
 * credential: it must decode (signature, expiry, typ — lib/auth/
 * mobile-tokens.ts) or the request is 401, and any cookie that came along is
 * ignored. Without the header, the Auth.js session cookie, exactly as before.
 */
async function readClaims(): Promise<Claims | null> {
  const incoming = await headers()
  if (hasBearer(incoming)) {
    const token = bearerToken(incoming)
    const access = token ? await verifyAccessToken(token) : null
    if (!access) throw new HttpError(401, "Sign in to continue")
    return {
      id: access.sub,
      signedInAt: access.iat * 1000,
      via: "bearer",
      tokenVersion: access.tokenVersion,
    }
  }

  const session = await auth()
  const user = session?.user
  if (!user?.id) return null
  return { id: user.id, signedInAt: user.signedInAt, via: "cookie" }
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

/**
 * A session signed in before the account's sessionsValidAfter (set when a
 * removed account is adopted) no longer counts. A token from before the
 * stamp existed has no signedInAt and counts as stale once one is set.
 */
export function isStaleSession(signedInAt: number | undefined, validAfter: Date | null | undefined) {
  if (!validAfter) return false
  return !signedInAt || signedInAt < validAfter.getTime()
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
  // The admin area is web-only: a mobile token never opens it.
  if (hasBearer(await headers())) {
    throw new HttpError(403, "You don't have access to that")
  }

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

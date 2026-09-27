import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { Types } from "mongoose"

import { loadMembership } from "@/lib/auth/membership"
import { ACCESS_TOKEN_TTL_S, issueAccessToken } from "@/lib/auth/mobile-tokens"
import { connectToDatabase } from "@/lib/mongodb"
import { MobileSession } from "@/models/mobile-session"
import { User, type UserRole } from "@/models/user"

/**
 * Refresh tokens for the mobile app, and the kill switch for them.
 *
 * A refresh token is 256 random bits, returned once; only its SHA-256 is
 * stored (models/mobile-session.ts). Each refresh revokes the row presented
 * and issues a new one in the same family; presenting a revoked row again
 * revokes the whole family, because a used token turning up twice means a
 * copy exists somewhere it shouldn't.
 */

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

type Id = string | Types.ObjectId

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }

type Holder = { id: string; businessId: string; role: UserRole; tokenVersion: number }

async function mint(holder: Holder, deviceName: string | undefined, familyId: string): Promise<TokenPair> {
  const refreshToken = randomBytes(32).toString("base64url")
  const now = new Date()
  await MobileSession.create({
    userId: holder.id,
    businessId: holder.businessId,
    deviceName,
    familyId,
    hash: sha256(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    lastUsedAt: now,
  })
  const accessToken = await issueAccessToken({
    sub: holder.id,
    businessId: holder.businessId,
    role: holder.role,
    tokenVersion: holder.tokenVersion,
  })
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S }
}

/** A fresh pair for someone who has just proved their password. */
export async function startMobileSession(
  user: { id: string; businessId: string; role: UserRole },
  deviceName?: string
): Promise<TokenPair> {
  await connectToDatabase()
  const row = await User.findById(user.id).select("tokenVersion").lean()
  return mint({ ...user, tokenVersion: row?.tokenVersion ?? 0 }, deviceName, randomUUID())
}

/**
 * Trade a refresh token for a new pair. Null for every refusal: unknown,
 * expired, revoked, reused (which also revokes its family), or an account
 * that has since been removed or blocked.
 */
export async function rotateMobileSession(refreshToken: string): Promise<TokenPair | null> {
  await connectToDatabase()
  const hash = sha256(refreshToken)
  const now = new Date()

  // Claiming the row is one atomic write, so two refreshes racing with the
  // same token can't both succeed.
  const claimed = await MobileSession.findOneAndUpdate(
    { hash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, lastUsedAt: now } },
    { returnDocument: "before" }
  ).lean()

  if (!claimed) {
    const seen = await MobileSession.findOne({ hash }).select("familyId revokedAt").lean()
    if (seen?.revokedAt) {
      // Reuse of a spent token: whoever holds the family's live token is
      // suspect too, so the whole family ends here.
      await MobileSession.updateMany(
        { familyId: seen.familyId, revokedAt: null },
        { $set: { revokedAt: now } }
      )
    }
    return null
  }

  const found = await loadMembership(String(claimed.userId))
  const member = found?.member
  const business = found?.business
  if (
    !member ||
    !business ||
    member.status === "removed" ||
    member.blockedAt ||
    business.blockedAt ||
    String(business._id) !== String(claimed.businessId)
  ) {
    return null
  }

  return mint(
    {
      id: String(member._id),
      businessId: String(business._id),
      role: member.role,
      tokenVersion: member.tokenVersion ?? 0,
    },
    claimed.deviceName ?? undefined,
    claimed.familyId
  )
}

/** Revoke one refresh token. Quiet about whether it existed. */
export async function endMobileSession(refreshToken: string) {
  await connectToDatabase()
  await MobileSession.updateOne(
    { hash: sha256(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  )
}

/**
 * Every mobile token these accounts hold stops working now: refresh tokens
 * are revoked, and bumping tokenVersion makes access tokens already issued
 * fail the guard's check on their next request. Called on a block, a role
 * change, a removal, an adoption into another workspace, a password change
 * and "log out everywhere". Web cookie sessions are not affected by this.
 */
export async function revokeMobileAccess(userIds: readonly Id[]) {
  if (userIds.length === 0) return
  await connectToDatabase()
  const ids = [...userIds]
  await Promise.all([
    User.updateMany({ _id: { $in: ids } }, { $inc: { tokenVersion: 1 } }),
    MobileSession.updateMany(
      { userId: { $in: ids }, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    ),
  ])
}

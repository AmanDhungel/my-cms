import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"

import type { UserRole } from "@/models/user"

export const SESSION_COOKIE = "ems_session"

const DAY = 60 * 60 * 24
const DEFAULT_MAX_AGE = DAY
const REMEMBER_MAX_AGE = DAY * 30

export type SessionPayload = {
  userId: string
  businessId: string
  role: UserRole
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters. Add it to .env.local"
    )
  }
  return new TextEncoder().encode(secret)
}

/** Signs the session and writes it as an httpOnly cookie. */
export async function createSession(
  payload: SessionPayload,
  { remember = false }: { remember?: boolean } = {}
) {
  const maxAge = remember ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE

  const token = await new SignJWT({
    businessId: payload.businessId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret())

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  })
}

/** Returns the caller's session, or null if the cookie is absent or invalid. */
export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    return {
      userId: payload.sub,
      businessId: String(payload.businessId),
      role: payload.role as UserRole,
    }
  } catch {
    // Expired, tampered with, or signed by an older AUTH_SECRET.
    return null
  }
}

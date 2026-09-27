import { decode, encode } from "next-auth/jwt"

import type { UserRole } from "@/models/user"

/**
 * Mobile access tokens.
 *
 * Minted and read with Auth.js' own `encode` / `decode` (next-auth/jwt), keyed
 * off AUTH_SECRET like the web session, but under a salt of their own — so a
 * web session cookie can never be presented as a mobile token, nor the other
 * way round. The result is an encrypted, integrity-protected JWT (JWE,
 * dir + A256CBC-HS512): a tampered or expired token fails to decode.
 *
 * Crypto only, no database: src/proxy.ts imports this to recognise a Bearer
 * request before any route runs. Whether the token is still current
 * (tokenVersion, membership) is the guard's question (lib/auth/guards.ts).
 */

export const ACCESS_TOKEN_SALT = "ems-mobile-access"
export const ACCESS_TOKEN_TTL_S = 15 * 60

export type AccessClaims = {
  sub: string
  businessId: string
  role: UserRole
  tokenVersion: number
  typ: "access"
  /** Seconds since the epoch, set by `encode`. */
  iat: number
  exp: number
}

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error("AUTH_SECRET is not set")
  return value
}

export function issueAccessToken(claims: {
  sub: string
  businessId: string
  role: UserRole
  tokenVersion: number
}) {
  return encode({
    token: { ...claims, typ: "access" },
    secret: secret(),
    salt: ACCESS_TOKEN_SALT,
    maxAge: ACCESS_TOKEN_TTL_S,
  })
}

const ROLES = new Set<string>(["owner", "supervisor", "employee"])

/** The claims of a genuine, unexpired access token, or null. */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  if (!token || token.length > 4096) return null
  try {
    const payload = await decode({ token, secret: secret(), salt: ACCESS_TOKEN_SALT })
    if (!payload) return null
    const { sub, businessId, role, tokenVersion, typ, iat, exp } = payload as Record<string, unknown>
    if (
      typ !== "access" ||
      typeof sub !== "string" ||
      typeof businessId !== "string" ||
      typeof role !== "string" ||
      !ROLES.has(role) ||
      typeof tokenVersion !== "number" ||
      typeof iat !== "number" ||
      typeof exp !== "number"
    ) {
      return null
    }
    return { sub, businessId, role: role as UserRole, tokenVersion, typ, iat, exp }
  } catch {
    return null
  }
}

/**
 * Whether the request says it is a Bearer request at all. When it does, it
 * is authenticated by that token alone — never by a cookie riding along.
 */
export function hasBearer(headers: Headers) {
  return /^bearer\s/i.test(headers.get("authorization") ?? "")
}

/** The token from `Authorization: Bearer <token>`, or null. */
export function bearerToken(headers: Headers) {
  const match = (headers.get("authorization") ?? "").match(/^bearer\s+(\S+)\s*$/i)
  return match ? match[1] : null
}

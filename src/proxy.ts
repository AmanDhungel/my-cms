import { createHash } from "node:crypto"
import NextAuth from "next-auth"
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"

import { authConfig } from "@/auth.config"
import { clientIp } from "@/lib/security/client-ip"
import { limitBy, tooManyMessage } from "@/lib/security/rate-limit"
import { CROSS_ORIGIN_MESSAGE, isMutating, isSameOrigin } from "@/lib/security/same-origin"
import { tenantFromHost } from "@/lib/tenancy"

/**
 * In front of every page and most API routes, in this order:
 *
 * 1. Security: a per-request CSP nonce (Next applies it to its own scripts
 *    when it sees the CSP on the request), a same-origin check on API
 *    mutations (CSRF), and rate limits for public pages and signed-in
 *    mutations (Mongo-backed; Proxy runs on the Node.js runtime).
 * 2. Tenancy: a request arriving at `balaju.localhost:3000` is a visitor
 *    looking at that workspace's public site, not anyone using EMS. It is
 *    rewritten onto `/sites/balaju`; the address bar keeps saying the
 *    subdomain. A tenant host has no API: /api there answers 404.
 * 3. The edge-safe half of the Auth.js config, which gates /dashboard,
 *    /admin and /choose on the platform's own host.
 *
 * This is the `proxy` convention that replaced `middleware` in Next 16.
 */

const gate = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent
) => Promise<Response | undefined> | Response | undefined

/** The paths that need a session. Kept in step with the auth matcher below. */
const GATED = ["/dashboard", "/admin", "/choose"]

/** Origins pictures may load from: our bucket, a configured CDN, map tiles. */
function imageOrigins() {
  const origins = new Set<string>()
  const bucket = process.env.AWS_BUCKET_NAME
  const region = process.env.AWS_REGION
  if (bucket && region) origins.add(`https://${bucket}.s3.${region}.amazonaws.com`)
  if (bucket) origins.add(`https://${bucket}.s3.amazonaws.com`)
  const base = process.env.AWS_PUBLIC_BASE_URL
  if (base) {
    try {
      origins.add(new URL(base).origin)
    } catch {
      // A malformed base adds nothing.
    }
  }
  // The map picker's tiles (Leaflet + OpenStreetMap).
  origins.add("https://tile.openstreetmap.org")
  return [...origins].join(" ")
}

export function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development"
  return [
    "default-src 'self'",
    // 'unsafe-eval' in development only: React's dev build uses eval for
    // its debugging stacks, and Turbopack's HMR needs it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${imageOrigins()}`,
    "font-src 'self'",
    // 'self' covers same-origin fetches and, in development, the HMR socket.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")
}

function withSecurity(response: Response, csp: string) {
  response.headers.set("Content-Security-Policy", csp)
  return response
}

function json(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers })
}

/** A session-scoped key for signed-in rate limits (the cookie, hashed). */
function sessionKey(request: NextRequest) {
  const token =
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value
  return token
    ? `session:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`
    : `ip:${clientIp(request.headers)}`
}

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent
): Promise<Response | undefined> {
  const path = request.nextUrl.pathname
  const isApi = path === "/api" || path.startsWith("/api/")
  const slug = tenantFromHost(request.headers.get("host"))

  // A public site has no API.
  if (slug && isApi) return json(404, "Not found")

  // CSRF: an API write must come from this app's own pages.
  if (isApi && !isSameOrigin(request.method, request.headers)) {
    return json(403, CROSS_ORIGIN_MESSAGE)
  }

  // Rate limits. Public pages per IP; every other signed-in write per session.
  const publicPage =
    Boolean(slug) || path.startsWith("/quote/") || path.startsWith("/api/quote/")
  if (publicPage || (isApi && isMutating(request.method))) {
    const result = publicPage
      ? await limitBy("publicPage", clientIp(request.headers))
      : await limitBy("mutation", sessionKey(request))
    if (!result.ok) {
      const headers = { "Retry-After": String(result.retryAfter) }
      return isApi
        ? json(429, tooManyMessage(result.retryAfter), headers)
        : new NextResponse(tooManyMessage(result.retryAfter), {
            status: 429,
            headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
          })
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = contentSecurityPolicy(nonce)
  // Next reads the CSP from the request and stamps the nonce on its scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  if (slug) {
    const url = request.nextUrl.clone()

    // A tenant host has no business serving the product's own pages: asking
    // for `balaju.localhost/dashboard` should get Balaju's site, not EMS's
    // dashboard on somebody else's domain.
    if (GATED.some((gated) => url.pathname.startsWith(gated))) {
      url.pathname = "/"
      return withSecurity(NextResponse.redirect(url), csp)
    }

    // Everything else on this host is the site itself.
    url.pathname = `/sites/${slug}${url.pathname === "/" ? "" : url.pathname}`
    return withSecurity(
      NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      csp
    )
  }

  const pass = () =>
    withSecurity(NextResponse.next({ request: { headers: requestHeaders } }), csp)

  if (!GATED.some((gated) => path.startsWith(gated))) return pass()

  // The gate decides; a redirect to sign-in is returned as it is. Otherwise
  // the request goes on with the nonce headers, carrying over any session
  // cookie the gate refreshed.
  const decided = await gate(request, event)
  if (decided && decided.status >= 300 && decided.status < 400) {
    return withSecurity(decided, csp)
  }
  const response = pass()
  decided?.headers.getSetCookie?.().forEach((cookie) => {
    response.headers.append("Set-Cookie", cookie)
  })
  return response
}

export const config = {
  /**
   * Everything except the things a rewrite would only get in the way of.
   *
   * It has to be this wide because the tenant check reads the *host*, not the
   * path — a matcher of just `/dashboard` would never see a request for a
   * site's home page. The exclusions are the framework's own asset routes,
   * the auth endpoints, the upload endpoint, and anything with a file extension.
   *
   * Uploads are excluded for a reason that is easy to miss: Next buffers the
   * whole request body before a matched route handler runs, so a size check
   * inside the handler could only ever fire after the bytes had arrived.
   * Outside the matcher the handler sees the headers first and can refuse an
   * oversized body before reading it. The route does its own auth, tenant,
   * same-origin and rate-limit checks.
   */
  matcher: [
    "/((?!api/auth|api/uploads|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
}

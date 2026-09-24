import NextAuth from "next-auth"
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"

import { authConfig } from "@/auth.config"
import { tenantFromHost } from "@/lib/tenancy"

/**
 * Two jobs, in this order.
 *
 * First, tenancy: a request arriving at `balaju.localhost:3000` is a visitor
 * looking at that workspace's public site, not anyone using EMS. It is
 * rewritten onto `/sites/balaju`, which the visitor never sees — the address
 * bar keeps saying `balaju.localhost`. Rewriting rather than redirecting is
 * what makes the subdomain the real address of the site.
 *
 * Second, the edge-safe half of the Auth.js config, which gates /dashboard,
 * /admin and /choose. That only applies on the platform's own host: a tenant
 * site is public by definition, and running the auth check there would bounce
 * strangers to a login page for a business they have never heard of.
 *
 * This is the `proxy` convention that replaced `middleware` in Next 16.
 */

/**
 * Auth.js types its handler for its own invocation rather than as a plain
 * proxy function, so it is narrowed to the shape it is actually called with.
 */
const gate = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent
) => Promise<Response | undefined> | Response | undefined

/** The paths that need a session. Kept in step with the auth matcher below. */
const GATED = ["/dashboard", "/admin", "/choose"]

/**
 * The return type is written out rather than inferred: without it TypeScript
 * follows this function into the auth handler and back, and gives up.
 */
export default function proxy(
  request: NextRequest,
  event: NextFetchEvent
): Promise<Response | undefined> | Response | undefined {
  const slug = tenantFromHost(request.headers.get("host"))

  if (slug) {
    const url = request.nextUrl.clone()

    // A tenant host has no business serving the product's own pages: asking
    // for `balaju.localhost/dashboard` should get Balaju's site, not EMS's
    // dashboard on somebody else's domain.
    if (GATED.some((path) => url.pathname.startsWith(path))) {
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    // Everything else on this host is the site itself.
    url.pathname = `/sites/${slug}${url.pathname === "/" ? "" : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (!GATED.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next()
  }

  return gate(request, event)
}

export const config = {
  /**
   * Everything except the things a rewrite would only get in the way of.
   *
   * It has to be this wide because the tenant check reads the *host*, not the
   * path — a matcher of just `/dashboard` would never see a request for a
   * site's home page. The exclusions are the framework's own asset routes,
   * the auth endpoints, and anything with a file extension.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
  ],
}

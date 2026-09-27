import type { NextConfig } from "next"

/**
 * Test accounts belong in a test database only.
 *
 * The harness signs in a super admin at @emstest.local and creates dozens of
 * workspaces a run. A server started with such an address in
 * SUPER_ADMIN_EMAILS against a database whose name doesn't end in "_test"
 * would scatter that data through the real one — so it refuses to start.
 */
function assertTestAccountsStayInTestDatabase() {
  const admins = process.env.SUPER_ADMIN_EMAILS ?? ""
  const database = process.env.MONGODB_DB ?? ""
  if (/@emstest\.local/i.test(admins) && !database.endsWith("_test")) {
    throw new Error(
      `Refusing to start: SUPER_ADMIN_EMAILS contains a test account (@emstest.local) but MONGODB_DB is "${database}". ` +
        `Point a test server at a database whose name ends in "_test".`
    )
  }
}
assertTestAccountsStayInTestDatabase()

/**
 * Headers every response carries — pages, API, static files and the public
 * tenant sites. The Content-Security-Policy for pages is per request (it
 * carries a nonce) and is set in src/proxy.ts; the API routes the proxy
 * doesn't see get a locked-down one here.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // HTTPS only in production; a dev server on http://localhost must not
  // teach the browser to refuse it.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
]

const nextConfig: NextConfig = {
  // Keep mongoose out of the bundler: it loads native/optional deps at runtime.
  serverExternalPackages: ["mongoose"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // JSON from the routes the proxy is kept off: nothing to run or embed.
      ...["/api/auth/:path*", "/api/uploads"].map((source) => ({
        source,
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
        ],
      })),
      // Pictures in public/ keep their names when they change, so a day's
      // cache and a week of serving stale while re-checking, not "immutable".
      {
        source: "/:file*\\.(webp|avif|png|jpg|jpeg|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ]
  },
}

export default nextConfig

import type { NextConfig } from "next"

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
    ]
  },
}

export default nextConfig

import NextAuth from "next-auth"

import { authConfig } from "@/auth.config"

/**
 * Runs the edge-safe half of the Auth.js config so every /dashboard and
 * /admin route is gated before it renders. Unauthenticated visitors are sent
 * to /login; who may actually enter /admin is settled on the server.
 *
 * This is the `proxy` convention that replaced `middleware` in Next 16.
 */
export default NextAuth(authConfig).auth

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/choose"],
}

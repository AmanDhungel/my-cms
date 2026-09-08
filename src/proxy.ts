import NextAuth from "next-auth"

import { authConfig } from "@/auth.config"

/**
 * Runs the edge-safe half of the Auth.js config so every /dashboard route is
 * gated before it renders. Unauthenticated visitors are sent to /login.
 *
 * This is the `proxy` convention that replaced `middleware` in Next 16.
 */
export default NextAuth(authConfig).auth

export const config = {
  matcher: ["/dashboard/:path*"],
}

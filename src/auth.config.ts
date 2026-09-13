import type { NextAuthConfig } from "next-auth"

/**
 * The edge-safe half of the Auth.js config. `proxy.ts` uses this on its
 * own so route protection never has to import mongoose or bcrypt, neither of
 * which run on the edge runtime. The Credentials provider lives in `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    /** Gate for `proxy.ts`. Everything under /dashboard needs a session. */
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
        return Boolean(auth?.user)
      }
      return true
    },
    /** `user` is only set on sign-in; afterwards the claims ride in the token. */
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.businessId = user.businessId
        token.superAdmin = user.superAdmin ?? false
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub ?? ""
      session.user.role = token.role
      session.user.businessId = token.businessId
      session.user.superAdmin = token.superAdmin ?? false
      return session
    },
  },
} satisfies NextAuthConfig

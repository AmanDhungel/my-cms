import type { DefaultSession } from "next-auth"

import type { UserRole } from "@/models/user"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      businessId: string
    } & DefaultSession["user"]
  }

  /** What `authorize()` returns, which feeds the `jwt` callback. */
  interface User {
    role: UserRole
    businessId: string
  }
}

/**
 * `next-auth/jwt` only re-exports `@auth/core/jwt`, so augmenting it declares a
 * separate interface instead of widening the one the callbacks actually use.
 * The original module is the one to merge into.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole
    businessId: string
  }
}

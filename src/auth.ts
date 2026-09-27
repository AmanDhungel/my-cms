import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/auth.config"
import { verifyCredentials } from "@/lib/auth/verify-credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // The password check lives in lib/auth/verify-credentials.ts, shared
      // with the mobile token login so there is only ever one copy of it.
      authorize: (credentials) => verifyCredentials(credentials),
    }),
  ],
})

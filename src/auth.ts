import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/auth.config"
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password"
import { connectToDatabase } from "@/lib/mongodb"
import { credentialsSchema } from "@/lib/validations/auth"
import { User } from "@/models/user"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        await connectToDatabase()

        const email = parsed.data.email.toLowerCase()
        const user = await User.findOne({ email }).select("+passwordHash")

        // Always compare, even with no account, so response time doesn't
        // reveal which emails are registered.
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? DUMMY_HASH
        )
        if (!user || !valid) return null

        // Removed members keep their row so history resolves, but they get no
        // way back in until another workspace's invite re-activates them.
        if (user.status === "removed") return null

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: String(user.business),
        }
      },
    }),
  ],
})

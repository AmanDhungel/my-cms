import { isSuperAdmin } from "@/lib/auth/super-admin"
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password"
import { connectToDatabase } from "@/lib/mongodb"
import { credentialsSchema } from "@/lib/validations/auth"
import { Business } from "@/models/business"
import { User } from "@/models/user"

/**
 * The one password check. The web's Auth.js Credentials provider calls this
 * as its `authorize` (src/auth.ts), and the mobile token login calls it too,
 * so there is never a second copy of these rules to drift.
 *
 * Returns the signed-in identity, or null for every kind of refusal — wrong
 * password, unknown email, removed, blocked account, blocked workspace — so
 * a caller can't tell them apart.
 */
export async function verifyCredentials(credentials: unknown) {
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

  // A block shuts the door here rather than at the first guard, so a
  // blocked account never gets a session cookie at all.
  if (user.blockedAt) return null

  const business = await Business.findById(user.business).select(
    "blockedAt"
  )
  if (business?.blockedAt) return null

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: String(user.business),
    // A hint for the UI only; every admin route re-checks the email.
    superAdmin: isSuperAdmin(user.email),
  }
}

import { logActivity } from "@/lib/activity"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

/**
 * The sign-in audit trail for the mobile login, recorded exactly as the web
 * sign-in records it (src/app/api/auth/[...nextauth]/route.ts:95-118):
 * successes, failures and rate-limited attempts, for known accounts only.
 * Passwords are never logged.
 */
export async function findLoginAccount(email: string) {
  try {
    await connectToDatabase()
    return await User.findOne({ email }).select("_id name business").lean()
  } catch {
    return null
  }
}

export function auditLogin(
  account: { _id: unknown; name?: string; business?: unknown },
  action: "login_succeeded" | "login_failed" | "login_rate_limited"
) {
  return logActivity({
    businessId: account.business as never,
    action,
    actorId: account._id as never,
    actorName: account.name ?? "",
    subject: account.name ?? "",
    targetKind: "account",
    targetId: account._id as never,
    href: "/dashboard/people",
  })
}

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import type { UserRole } from "@/models/user"

/**
 * Page-level counterpart to the API guards. Anonymous visitors go to /login;
 * a signed-in member on the wrong side of the app goes back to /dashboard,
 * which renders the shell their role actually has.
 */
export async function requirePageRole(...roles: readonly UserRole[]) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  if (!roles.includes(session.user.role)) {
    redirect("/dashboard")
  }

  return session.user
}

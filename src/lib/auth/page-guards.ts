import { redirect } from "next/navigation"
import { cache } from "react"

import { auth } from "@/auth"
import { isStaleSession } from "@/lib/auth/guards"
import { loadMembership, rememberWorkspace } from "@/lib/auth/membership"
import { connectToDatabase } from "@/lib/mongodb"
import type { UserRole } from "@/models/user"

export type PageViewer = {
  id: string
  name: string
  email: string
  role: UserRole
  businessId: string
}

/**
 * Page-level counterpart to the API guards, and like them it confirms
 * membership against the database rather than trusting the JWT's claims.
 * Anonymous visitors go to /login; someone who has been removed goes to
 * /removed; a member on the wrong side of the app goes back to /dashboard.
 */
export async function requirePageRole(
  ...roles: readonly UserRole[]
): Promise<PageViewer> {
  const viewer = await loadViewer()

  if (!roles.includes(viewer.role)) {
    redirect("/dashboard")
  }

  return viewer
}

/** The membership check on its own, for pages that serve every role. */
/**
 * Once per render: a layout and its page both ask, and share one answer
 * (React cache is scoped to the request).
 */
export const loadViewer = cache(loadViewerUncached)

async function loadViewerUncached(): Promise<PageViewer> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()

  // The workspace rides along so a blocked one shuts out everyone in it —
  // in the same round trip as the account (lib/auth/membership.ts).
  const found = await loadMembership(session.user.id)
  const member = found?.member
  const business = found?.business

  if (!member) {
    redirect("/login")
  }

  if (member.status === "removed") {
    redirect("/removed")
  }

  if (member.blockedAt || business?.blockedAt) {
    redirect("/blocked")
  }

  if (!business) {
    throw new Error("The account's workspace no longer exists")
  }

  if (isStaleSession(session.user.signedInAt, member.sessionsValidAfter)) {
    redirect("/login")
  }

  const viewer: PageViewer = {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    businessId: String(business._id),
  }
  rememberWorkspace(viewer, business)
  return viewer
}

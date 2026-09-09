import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { User, type UserRole } from "@/models/user"

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
export async function loadViewer(): Promise<PageViewer> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()

  const member = await User.findById(session.user.id).select(
    "name email role business status"
  )

  if (!member) {
    redirect("/login")
  }

  if (member.status === "removed") {
    redirect("/removed")
  }

  return {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    businessId: String(member.business),
  }
}

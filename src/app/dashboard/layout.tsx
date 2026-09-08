import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { EmployeeShell } from "@/components/dashboard/employee-shell"
import { OwnerShell } from "@/components/dashboard/owner-shell"
import { connectToDatabase } from "@/lib/mongodb"
import { Business } from "@/models/business"
import { Invite } from "@/models/invite"
import { User } from "@/models/user"

/** Sessions are per-request; nothing under /dashboard may be cached. */
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await auth()

  // `proxy.ts` already blocks anonymous requests; this is the second
  // gate, so a misconfigured matcher can't leak a page.
  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()

  const business = await Business.findById(session.user.businessId)

  if (!business) {
    redirect("/login")
  }

  const viewer = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    businessName: business.name,
  }

  if (session.user.role === "employee") {
    const me = await User.findById(session.user.id).select("shift")
    return (
      <EmployeeShell viewer={{ ...viewer, shift: me?.shift ?? null }}>
        {children}
      </EmployeeShell>
    )
  }

  const [people, pendingInvites] = await Promise.all([
    User.countDocuments({ business: business._id }),
    Invite.countDocuments({
      business: business._id,
      acceptedAt: { $exists: false },
    }),
  ])

  return (
    <OwnerShell viewer={viewer} counts={{ people, pendingInvites }}>
      {children}
    </OwnerShell>
  )
}

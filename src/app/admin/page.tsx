import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminView } from "@/components/admin/admin-view"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

/** Nothing here may be cached: it is the whole system, per request. */
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Super admin · EMS" }

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()

  // The email is read from the row rather than the token, and checked against
  // the environment — the database has no say in who is a super admin.
  const me = await User.findById(session.user.id).select("name email")

  if (!me || !isSuperAdmin(me.email)) {
    redirect("/dashboard")
  }

  return <AdminView admin={{ name: me.name, email: me.email }} />
}

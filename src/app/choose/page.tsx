import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Where to · EMS" }

/**
 * The fork for an account that is both an owner and a super admin. Everyone
 * else is sent straight on, so the extra step only exists for those who have
 * an actual choice to make.
 */
export default async function ChoosePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()
  const me = await User.findById(session.user.id).select("name email")

  if (!me || !isSuperAdmin(me.email)) {
    redirect("/dashboard")
  }

  return (
    <main className="bg-n-50 flex min-h-screen items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
            Signed in as {me.email}
          </p>
          <h1 className="font-heading m-0 text-[30px] font-bold tracking-[-0.015em]">
            Where are you headed?
          </h1>
          <p className="text-n-600 m-0 text-[14.5px]">
            This account runs a workspace and administers the deployment. Pick
            one — you can move between them at any time.
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Link
            href="/dashboard"
            className="border-n-300 hover:border-p-400 hover:bg-p-100/40 flex flex-col gap-2 rounded-xl border bg-white p-5 transition-colors"
          >
            <span className="font-heading text-[16px] font-semibold">
              My workspace
            </span>
            <span className="text-n-600 text-[13px] leading-relaxed">
              Your own tasks, crew, stock and bills — the app as an owner sees
              it.
            </span>
          </Link>

          <Link
            href="/admin"
            className="border-n-300 hover:border-p-400 hover:bg-p-100/40 flex flex-col gap-2 rounded-xl border bg-white p-5 transition-colors"
          >
            <span className="font-heading text-[16px] font-semibold">
              Super admin
            </span>
            <span className="text-n-600 text-[13px] leading-relaxed">
              Every business, person and project on this deployment, and the
              switch that blocks one.
            </span>
          </Link>
        </div>

        <SignOutButton className="border-n-300 text-n-700 hover:bg-n-100 self-start rounded-md border bg-white px-3 py-1.5 text-[13px] font-semibold transition-colors" />
      </div>
    </main>
  )
}

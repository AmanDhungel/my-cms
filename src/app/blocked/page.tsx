import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { SiteHeader } from "@/components/landing/site-header"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Account blocked · EMS" }

/**
 * Where a blocked account lands. Sign-in already refuses them, so the only
 * way to see this is a session that was open when the block landed — the
 * guards send them here rather than letting the page render.
 */
export default async function BlockedPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()

  const member = await User.findById(session.user.id)
    .select("blockedAt business")
    .populate<{ business: { blockedAt?: Date } }>("business", "blockedAt")

  // Unblocked since? Then there is nothing to hold them here.
  if (member && !member.blockedAt && !member.business?.blockedAt) {
    redirect("/dashboard")
  }

  const wholeWorkspace = Boolean(member && !member.blockedAt)

  return (
    <>
      <SiteHeader />
      <main className="bg-n-50 flex min-h-[calc(100vh-60px)] items-center justify-center px-6 py-16">
        <div className="border-n-200 flex w-full max-w-[520px] flex-col gap-4 rounded-[14px] border bg-white p-8">
          <p className="text-s-overdue font-mono text-xs tracking-[0.08em] uppercase">
            Blocked
          </p>
          <h1 className="font-heading m-0 text-[28px] font-bold tracking-[-0.015em]">
            {wholeWorkspace
              ? "This workspace has been blocked"
              : "This account has been blocked"}
          </h1>
          <p className="text-n-600 m-0 text-[14.5px] leading-relaxed">
            {wholeWorkspace
              ? "Everyone in the workspace is shut out, whatever their role. Nothing has been deleted — the work is all still there."
              : "You can't sign in or open the dashboard. Nothing has been deleted — your record and your work are intact."}{" "}
            Get in touch with whoever runs this deployment to have it lifted.
          </p>
          <div className="border-n-200 mt-2 flex flex-wrap gap-2.5 border-t pt-5">
            <SignOutButton className="bg-p-500 rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]" />
            <Link
              href="/"
              className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              Back to site
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

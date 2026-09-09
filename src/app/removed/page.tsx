import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { SiteHeader } from "@/components/landing/site-header"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "No workspace · EMS" }

/**
 * Where a removed member lands. Their session cookie is still valid — the JWT
 * can't be revoked mid-flight — so this is the honest terminus: every guard
 * sends them here, and signing out is the only way onward.
 */
export default async function RemovedPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  await connectToDatabase()
  const member = await User.findById(session.user.id).select("status")

  // Re-invited since? Then they belong somewhere again.
  if (member && member.status !== "removed") {
    redirect("/dashboard")
  }

  return (
    <>
      <SiteHeader />
      <main className="bg-n-50 flex min-h-[calc(100vh-60px)] items-center justify-center px-6 py-16">
        <div className="border-n-200 flex w-full max-w-[520px] flex-col gap-4 rounded-[14px] border bg-white p-8">
          <p className="text-s-overdue font-mono text-xs tracking-[0.08em] uppercase">
            No workspace
          </p>
          <h1 className="font-heading m-0 text-[28px] font-bold tracking-[-0.015em]">
            You&rsquo;ve been removed from this workspace
          </h1>
          <p className="text-n-600 m-0 text-[14.5px] leading-relaxed">
            Your account still exists and your past work is intact, but you
            can&rsquo;t open the dashboard or sign in again until a workspace
            invites you. Ask an owner to send a new invite to{" "}
            <span className="font-semibold">{session.user.email}</span> — opening
            that link brings you back.
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

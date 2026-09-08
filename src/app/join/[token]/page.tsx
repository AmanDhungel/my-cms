import type { Metadata } from "next"
import Link from "next/link"

import { JoinForm } from "@/components/auth/join-form"
import { SiteHeader } from "@/components/landing/site-header"
import { findPendingInvite, type PendingInvite } from "@/lib/auth/invites"

export const metadata: Metadata = {
  title: "Join your crew · EMS",
  description: "Accept your invite and set a password to join the workspace.",
}

export default async function JoinPage({
  params,
}: PageProps<"/join/[token]">) {
  const { token } = await params

  let invite: PendingInvite | null = null
  try {
    invite = await findPendingInvite(token)
  } catch {
    invite = null
  }

  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[calc(100vh-60px)] lg:grid-cols-[1fr_1.05fr]">
        <div className="bg-n-50 flex items-center justify-center px-6 py-14 sm:px-10">
          {invite ? (
            <JoinForm token={token} invite={invite} />
          ) : (
            <ExpiredNotice />
          )}
        </div>

        <div className="relative hidden flex-col justify-between overflow-hidden bg-[repeating-linear-gradient(118deg,#073C3B_0_26px,#052A29_26px_52px)] bg-fixed px-12 py-11 lg:flex">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(200deg,rgba(5,42,41,0.55),rgba(5,42,41,0.92))]"
          />
          <span className="relative font-mono text-[11px] tracking-[0.06em] text-[rgba(234,246,245,0.5)]">
            photo — crew briefing, first light · 1200×1600
          </span>

          <div className="relative flex max-w-[400px] flex-col gap-5">
            <h2 className="font-heading text-p-50 text-[32px] leading-[1.2] font-semibold tracking-[-0.015em]">
              {invite
                ? `${invite.businessName} is expecting you.`
                : "Invites are one link, one person."}
            </h2>
            <p className="text-p-100 text-[15px] leading-[1.7]">
              Your phone becomes the job sheet: today&rsquo;s tasks, the
              geofence you check in from, and the requests you send back.
            </p>
          </div>

          <div className="relative flex items-center gap-2.5 font-mono text-[11px] tracking-[0.06em] text-[rgba(157,219,212,0.9)]">
            <span aria-hidden className="bg-s-done size-2 rounded-full" />
            INVITE ONLY · ONE ACCOUNT PER LINK
          </div>
        </div>
      </main>
    </>
  )
}

function ExpiredNotice() {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      <p className="text-s-overdue font-mono text-xs tracking-[0.08em] uppercase">
        Link expired
      </p>
      <h1 className="font-heading text-[30px] font-bold tracking-[-0.015em]">
        That invite is no longer valid
      </h1>
      <p className="text-n-600 text-[14.5px] leading-relaxed">
        Invite links last seven days and work once. Ask the workspace owner to
        send a new one — it arrives on the same email address.
      </p>
      <div className="border-n-300 mt-1 flex flex-col gap-2.5 border-t border-dashed pt-4">
        <p className="text-n-600 text-sm">
          Already set a password?{" "}
          <Link href="/login" className="font-semibold">
            Log in
          </Link>
        </p>
        <Link href="/" className="text-n-500 text-[13.5px]">
          ← Back to site
        </Link>
      </div>
    </div>
  )
}

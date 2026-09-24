import type { Metadata } from "next"
import Link from "next/link"

import { BootstrapSignup } from "@/components/auth/bootstrap-signup"
import { SignupForm } from "@/components/auth/signup-form"
import { SiteHeader } from "@/components/landing/site-header"
import {
  findPendingWorkspaceInvite,
  type PendingWorkspaceInvite,
} from "@/lib/auth/workspace-invites"

/** The invite decides what renders, so this can never be cached. */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Create a workspace · EMS",
  description:
    "Set up your EMS workspace, then invite your crew and assign the first located ticket.",
}

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { invite: token } = await searchParams
  const raw = typeof token === "string" ? token : ""

  let invite: PendingWorkspaceInvite | null = null
  if (raw) {
    try {
      invite = await findPendingWorkspaceInvite(raw)
    } catch {
      invite = null
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[calc(100vh-60px)] lg:grid-cols-[1fr_1.05fr]">
        <div className="bg-n-50 flex items-center justify-center px-6 py-14 sm:px-10">
          {invite ? (
            <SignupForm token={raw} invite={invite} />
          ) : (
            <NoInvite used={Boolean(raw)} />
          )}
        </div>

        <div className="relative hidden flex-col justify-between overflow-hidden bg-[repeating-linear-gradient(118deg,#073C3B_0_26px,#052A29_26px_52px)] bg-fixed px-12 py-11 lg:flex">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(200deg,rgba(5,42,41,0.55),rgba(5,42,41,0.92))]"
          />
          <span className="relative font-mono text-[11px] tracking-[0.06em] text-[rgba(234,246,245,0.5)]">
            photo — dispatch board, morning shift · 1200×1600
          </span>

          <div className="relative flex max-w-[400px] flex-col gap-5">
            <h2 className="font-heading text-p-50 text-[32px] leading-[1.2] font-semibold tracking-[-0.015em]">
              What you get on day one
            </h2>
            <ul className="flex flex-col gap-3.5">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-p-300 mt-[7px] size-2 shrink-0 rounded-full"
                />
                <p className="text-p-100 text-[15px] leading-[1.6]">
                  Located tickets with deadlines and a geofence radius you set per
                  job.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-p-300 mt-[7px] size-2 shrink-0 rounded-full"
                />
                <p className="text-p-100 text-[15px] leading-[1.6]">
                  Check-in and check-out notifications the moment they happen.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-a-300 mt-[7px] size-2 shrink-0 rounded-full"
                />
                <p className="text-a-100 text-[15px] leading-[1.6]">
                  Leave and advance requests routed to you for approval.
                </p>
              </li>
            </ul>
          </div>

          <div className="relative flex items-center gap-2.5 font-mono text-[11px] tracking-[0.06em] text-[rgba(157,219,212,0.9)]">
            <span aria-hidden className="bg-s-done size-2 rounded-full" />
            BY INVITATION · ONE LINK, ONE WORKSPACE
          </div>
        </div>
      </main>
    </>
  )
}

/**
 * There is no open sign-up. A link that was never given, already spent,
 * revoked or expired all land here — the same answer, so a token can't be
 * probed for near-misses.
 */
function NoInvite({ used }: { used: boolean }) {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <p className="text-a-700 font-mono text-xs tracking-[0.08em] uppercase">
          By invitation
        </p>
        <h1 className="font-heading m-0 text-[30px] font-bold tracking-[-0.015em]">
          {used ? "That link is no longer valid" : "Sign-up is by invitation"}
        </h1>
        <p className="text-n-600 m-0 text-[14.5px] leading-relaxed">
          {used
            ? "Each link works once and lasts 14 days. This one has been used, withdrawn, or run out of time — ask for a fresh one."
            : "A workspace is opened by invitation only. If you have been sent a link, open that; it carries the invite with it."}
        </p>
      </div>

      <div className="border-n-200 flex flex-col gap-2 rounded-[14px] border bg-white p-5">
        <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
          ALREADY HAVE AN ACCOUNT
        </span>
        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          Crew members join through the link their owner sends, not from here.
        </p>
        <Link
          href="/login"
          className="bg-p-500 mt-1 self-start rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
        >
          Log in
        </Link>
      </div>

      <BootstrapSignup />
    </div>
  )
}

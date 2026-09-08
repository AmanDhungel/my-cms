import type { Metadata } from "next"

import { SignupForm } from "@/components/auth/signup-form"
import { SiteHeader } from "@/components/landing/site-header"

export const metadata: Metadata = {
  title: "Create a workspace · EMS",
  description:
    "Set up your EMS workspace, then invite your crew and assign the first located task.",
}

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[calc(100vh-60px)] lg:grid-cols-[1fr_1.05fr]">
        <div className="bg-n-50 flex items-center justify-center px-6 py-14 sm:px-10">
          <SignupForm />
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
                  Located tasks with deadlines and a geofence radius you set per
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
            NO CARD REQUIRED · 14 DAY TRIAL
          </div>
        </div>
      </main>
    </>
  )
}

import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"
import { SiteHeader } from "@/components/landing/site-header"

export const metadata: Metadata = {
  title: "Log in · EMS",
  description: "Sign in to your EMS field operations workspace.",
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[calc(100vh-60px)] lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[repeating-linear-gradient(118deg,#094F4E_0_26px,#073C3B_26px_52px)] bg-fixed px-12 py-11 lg:flex">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(160deg,rgba(5,42,41,0.62),rgba(5,42,41,0.9))]"
          />
          <div className="relative flex items-center gap-2.5">
            <span
              aria-hidden
              className="bg-p-400 flex size-[26px] items-center justify-center rounded-lg"
            >
              <span className="bg-p-900 size-[9px] rounded-full" />
            </span>
            <span className="font-heading text-p-50 text-base font-bold">
              EMS
            </span>
          </div>

          <div className="relative flex max-w-[420px] flex-col gap-[18px]">
            <h2 className="font-heading text-p-50 text-[36px] leading-[1.18] font-semibold tracking-[-0.015em]">
              Welcome back. Three tasks checked in while you were away.
            </h2>
            <p className="text-p-100 text-[15.5px] leading-[1.7]">
              Your dashboard picks up where the crew left off — arrivals,
              blocked work, and anything waiting on your approval.
            </p>
          </div>

          <span className="relative font-mono text-[11px] tracking-[0.06em] text-[rgba(234,246,245,0.5)]">
            photo — night shift handover · 1200×1600
          </span>
        </div>

        <div className="bg-n-50 flex items-center justify-center px-6 py-14 sm:px-10">
          <LoginForm />
        </div>
      </main>
    </>
  )
}

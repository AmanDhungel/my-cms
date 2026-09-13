"use client"

import * as React from "react"

import { SignupForm } from "@/components/auth/signup-form"

/**
 * The way out of the chicken-and-egg: invites come from a super admin, and a
 * super admin needs an account. The address in SUPER_ADMIN_EMAILS can open
 * the first workspace without a link — the server checks that, not this
 * button, so revealing the form gives nobody anything.
 */
export function BootstrapSignup() {
  const [open, setOpen] = React.useState(false)

  if (open) {
    return (
      <SignupForm
        token=""
        invite={{
          id: "",
          email: null,
          businessName: null,
          note: null,
          expiresAt: "",
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-n-500 hover:text-n-800 self-start text-[12.5px] font-semibold underline underline-offset-4"
    >
      Setting up this deployment?
    </button>
  )
}

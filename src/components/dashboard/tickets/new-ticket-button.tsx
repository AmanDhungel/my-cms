"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PlusIcon } from "@/components/dashboard/nav-icons"
import { TicketDialog } from "@/components/dashboard/tickets/ticket-dialog"
import { primaryButtonClass } from "@/components/dashboard/ui"

/**
 * Opens the assign-ticket dialog in place. The dashboard is a server component,
 * so a successful save also refreshes the route — otherwise the new ticket
 * wouldn't appear in the list right beneath the button.
 */
export function NewTicketButton({
  className = primaryButtonClass,
  label = "New ticket",
  withIcon = true,
}: {
  className?: string
  label?: string
  withIcon?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {withIcon ? <PlusIcon className="size-3.5" /> : null}
        {label}
      </button>
      <TicketDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  )
}

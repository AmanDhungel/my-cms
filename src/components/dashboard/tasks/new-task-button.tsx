"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PlusIcon } from "@/components/dashboard/nav-icons"
import { TaskDialog } from "@/components/dashboard/tasks/task-dialog"
import { primaryButtonClass } from "@/components/dashboard/ui"

/**
 * Opens the assign-task dialog in place. The dashboard is a server component,
 * so a successful save also refreshes the route — otherwise the new task
 * wouldn't appear in the list right beneath the button.
 */
export function NewTaskButton({
  className = primaryButtonClass,
  label = "New task",
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
      <TaskDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  )
}

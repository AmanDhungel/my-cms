"use client"

import { toast } from "sonner"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { reportMutationError, useRemoveMember } from "@/lib/queries"
import type { UserDTO } from "@/models/user"

/**
 * Removal is reversible only by a fresh invite, so it asks first and says
 * plainly what survives — the record and its history do, the access doesn't.
 */
export function RemoveMemberDialog({
  member,
  open,
  onClose,
}: {
  member: UserDTO
  open: boolean
  onClose: () => void
}) {
  const mutation = useRemoveMember(member.id)

  function remove() {
    if (mutation.isPending) return
    mutation.mutate(undefined, {
      onSuccess: ({ cancelledTasks }) => {
        toast.success(
          cancelledTasks > 0
            ? `${member.name} removed · ${cancelledTasks} unstarted task${cancelledTasks === 1 ? "" : "s"} cancelled`
            : `${member.name} removed`
        )
        onClose()
      },
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[460px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Remove {member.name}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {member.email}
          </DialogDescription>
        </DialogHeader>

        <ul className="text-n-600 m-0 flex list-none flex-col gap-2 p-0 text-[13.5px] leading-relaxed">
          <Point tone="bad">
            They are signed out and can&rsquo;t log in again, here or anywhere,
            until a workspace invites them.
          </Point>
          <Point tone="bad">
            Tasks they hadn&rsquo;t started are cancelled.
          </Point>
          <Point tone="good">
            Their finished work, check-ins and attendance stay exactly as they
            are.
          </Point>
          <Point tone="good">
            Inviting the same email later — from here or another workspace —
            brings the account back.
          </Point>
        </ul>

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Removing…" : "Remove from workspace"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Point({
  tone,
  children,
}: {
  tone: "good" | "bad"
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-[7px] size-1.5 shrink-0 rounded-full",
          tone === "bad" ? "bg-s-overdue" : "bg-s-done"
        )}
      />
      <span>{children}</span>
    </li>
  )
}

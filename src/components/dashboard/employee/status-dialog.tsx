"use client"

import * as React from "react"
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
import { inputClass } from "@/components/auth/field"
import { reportMutationError, useTicketStatus } from "@/lib/queries"
import { BLOCKER_SHORT } from "@/lib/tickets-client"
import { BLOCKER_REASONS, type BlockerReason } from "@/lib/work-constants"
import type { TicketDTO } from "@/models/ticket"

type Next = "in_progress" | "blocked" | "in_review"

/**
 * What the crew can set. Signing work off is the owner's move, so the last
 * step here is handing it over rather than closing it.
 */
const CHOICES: { value: Next; label: string; hint: string }[] = [
  { value: "in_progress", label: "In progress", hint: "Working on it now" },
  { value: "blocked", label: "Blocked", hint: "Waiting on something" },
  {
    value: "in_review",
    label: "Ready for review",
    hint: "Done my part — over to the owner",
  },
]

export function StatusDialog({
  ticket,
  open,
  onClose,
}: {
  ticket: TicketDTO
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[440px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Update status
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {ticket.title}
          </DialogDescription>
        </DialogHeader>
        {/* Remounted on each open, so the form never shows stale input. */}
        {open ? <Body ticket={ticket} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ ticket, onClose }: { ticket: TicketDTO; onClose: () => void }) {
  const [choice, setChoice] = React.useState<Next>(
    ticket.status === "in_progress" ? "blocked" : "in_progress",
  )
  const [reason, setReason] = React.useState(ticket.blockedReason ?? "")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [cause, setCause] = React.useState<BlockerReason>(
    ticket.blocker?.reason ?? "material"
  )
  const [needs, setNeeds] = React.useState<
    { name: string; qty: string; unit: string }[]
  >(() =>
    (ticket.blocker?.needs ?? []).map((one) => ({
      name: one.name,
      qty: one.qty ? String(one.qty) : "",
      unit: one.unit ?? "",
    }))
  )
  const mutation = useTicketStatus(ticket.id)

  function submit() {
    if (mutation.isPending) return

    if (choice === "blocked" && reason.trim().length < 3) {
      setReasonError("Say what you're blocked on")
      return
    }

    mutation.mutate(
      {
        status: choice,
        blockedReason: choice === "blocked" ? reason.trim() : undefined,
        blockerReason: choice === "blocked" ? cause : undefined,
        // Only material shortages carry a list; the other causes are a
        // sentence, and asking for quantities would be asking for nothing.
        needs:
          choice === "blocked" && cause === "material"
            ? needs
                .filter((one) => one.name.trim())
                .map((one) => ({
                  name: one.name.trim(),
                  qty: one.qty ? Number(one.qty) : undefined,
                  unit: one.unit.trim() || undefined,
                }))
            : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Status updated")
          onClose()
        },
        onError: (error) =>
          reportMutationError(error, (path, message) => {
            if (path === "blockedReason") setReasonError(message)
          }),
      },
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {CHOICES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setChoice(option.value)
              setReasonError(null)
            }}
            aria-pressed={choice === option.value}
            disabled={option.value === ticket.status}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors disabled:opacity-45",
              choice === option.value
                ? "border-p-400 bg-p-50"
                : "border-n-200 hover:bg-n-100 bg-white",
            )}
          >
            <span className="text-[14px] font-semibold">{option.label}</span>
            <span className="text-n-500 text-[12.5px]">
              {option.value === ticket.status ? "Current status" : option.hint}
            </span>
          </button>
        ))}

        {choice === "blocked" ? (
          <div className="mt-1 flex flex-col gap-[7px]">
            <span className="text-n-600 text-[12.5px] font-semibold tracking-[0.05em] uppercase">
              What kind of problem?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BLOCKER_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCause(option)}
                  aria-pressed={cause === option}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    cause === option
                      ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                      : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                  )}
                >
                  {BLOCKER_SHORT[option]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {choice === "blocked" && cause === "material" ? (
          <div className="border-n-200 flex flex-col gap-2 rounded-[10px] border bg-white p-3">
            <span className="text-n-600 text-[12.5px] font-semibold tracking-[0.05em] uppercase">
              What are you short of?
            </span>
            {needs.map((need, index) => (
              <div
                key={index}
                data-shortage-row
                className="grid gap-2 sm:grid-cols-[1fr_72px_72px_34px]"
              >
                <input
                  value={need.name}
                  onChange={(event) =>
                    setNeeds((prev) =>
                      prev.map((one, i) =>
                        i === index ? { ...one, name: event.target.value } : one
                      )
                    )
                  }
                  placeholder="2.5mm cable"
                  aria-label={`Material ${index + 1}`}
                  className={cn(inputClass, "h-[38px] py-1 text-[13px]")}
                />
                <input
                  type="number"
                  min={0}
                  value={need.qty}
                  onChange={(event) =>
                    setNeeds((prev) =>
                      prev.map((one, i) =>
                        i === index ? { ...one, qty: event.target.value } : one
                      )
                    )
                  }
                  placeholder="Qty"
                  aria-label={`Quantity ${index + 1}`}
                  className={cn(inputClass, "h-[38px] py-1 text-[13px]")}
                />
                <input
                  value={need.unit}
                  onChange={(event) =>
                    setNeeds((prev) =>
                      prev.map((one, i) =>
                        i === index ? { ...one, unit: event.target.value } : one
                      )
                    )
                  }
                  placeholder="m"
                  aria-label={`Unit ${index + 1}`}
                  className={cn(inputClass, "h-[38px] py-1 text-[13px]")}
                />
                <button
                  type="button"
                  aria-label={`Remove material ${index + 1}`}
                  onClick={() =>
                    setNeeds((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="border-n-300 text-n-500 h-[38px] rounded-md border bg-white px-2 text-[15px] leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            {needs.length < 15 ? (
              <button
                type="button"
                onClick={() =>
                  setNeeds((prev) => [...prev, { name: "", qty: "", unit: "" }])
                }
                className="border-n-300 text-n-700 hover:bg-n-100 w-fit rounded-md border border-dashed bg-white px-3 py-1.5 text-[12.5px] font-semibold"
              >
                Add a shortage
              </button>
            ) : null}
            <span className="text-n-500 text-[11.5px]">
              Your owner sees this, so they know what to bring.
            </span>
          </div>
        ) : null}

        {choice === "blocked" ? (
          <label className="mt-1 flex flex-col gap-[7px]">
            <span className="text-n-600 text-[12.5px] font-semibold tracking-[0.05em] uppercase">
              What&rsquo;s blocking you?
            </span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setReasonError(null)
              }}
              placeholder="Need two more rolls of pallet wrap"
              aria-invalid={Boolean(reasonError)}
              className={cn(inputClass, "min-h-[72px] resize-y")}
            />
            {reasonError ? (
              <span className="text-s-overdue text-[12.5px]">
                {reasonError}
              </span>
            ) : null}
          </label>
        ) : null}

        {choice === "in_review" && ticket.myCheckedInAt ? (
          <p className="text-n-500 m-0 text-[12.5px] leading-relaxed">
            You&rsquo;re still checked in — handing it over will check you out
            too.
          </p>
        ) : null}
      </div>

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
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </>
  )
}

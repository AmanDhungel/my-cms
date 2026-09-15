"use client"

import * as React from "react"
import { cn } from "cn"

import { FieldLabel, inputClass } from "@/components/auth/field"
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
import { formatDistance } from "@/lib/geo"
import { AWAY_REASON_LABELS } from "@/lib/office"
import { AWAY_REASONS, type AwayReason } from "@/lib/work-constants"

/**
 * Opened when the day is being started outside the office's outer ring. The
 * question is asked, not refused: people work from home, visit sites and sit
 * in meetings — the record just has to say which.
 */
export function ShiftStartDialog({
  open,
  distanceM,
  officeLabel,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean
  distanceM: number
  officeLabel: string | null
  pending: boolean
  onClose: () => void
  onConfirm: (reason: AwayReason, note: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[460px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Starting away from the office
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            You are {formatDistance(distanceM)} from{" "}
            {officeLabel ?? "the office"}.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Body pending={pending} onClose={onClose} onConfirm={onConfirm} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean
  onClose: () => void
  onConfirm: (reason: AwayReason, note: string) => void
}) {
  const [reason, setReason] = React.useState<AwayReason | null>(null)
  const [note, setNote] = React.useState("")

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <FieldLabel>Why here?</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {AWAY_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                aria-pressed={reason === option}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                  reason === option
                    ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                    : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                )}
              >
                {AWAY_REASON_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Anything to add</FieldLabel>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              reason === "other"
                ? "Optional, but worth saying here"
                : "Optional"
            }
            className={cn(inputClass, "min-h-[64px] resize-y")}
          />
        </label>
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
          onClick={() => reason && onConfirm(reason, note)}
          disabled={!reason || pending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start shift"}
        </button>
      </DialogFooter>
    </>
  )
}

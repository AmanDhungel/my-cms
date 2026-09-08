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
import { Skeleton } from "@/components/ui/skeleton"
import { inputClass } from "@/components/auth/field"
import { useLocationFix } from "@/components/dashboard/employee/use-location"
import { distanceInMetres, formatDistance } from "@/lib/geo"
import { reportMutationError, useCheckIn, useCheckOut } from "@/lib/queries"
import type { TaskDTO } from "@/models/task"

type Mode = "in" | "out"

/**
 * Reads the device's position, shows how far off the mark it is, and only then
 * submits. The server measures the distance again — this readout is for the
 * person holding the phone, not for the decision.
 */
export function CheckInDialog({
  task,
  mode,
  open,
  onClose,
}: {
  task: TaskDTO
  mode: Mode
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
            {mode === "in" ? "Check in" : "Check out"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {task.title} · {task.site}
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while open, so every reopen starts from a fresh
            position rather than a stale one. */}
        {open ? <Body task={task} mode={mode} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  task,
  mode,
  onClose,
}: {
  task: TaskDTO
  mode: Mode
  onClose: () => void
}) {
  const { fix, error: locationError, locating, retry } = useLocationFix()
  const [reason, setReason] = React.useState("")
  const [reasonError, setReasonError] = React.useState<string | null>(null)

  const checkIn = useCheckIn(task.id)
  const checkOut = useCheckOut(task.id)
  const mutation = mode === "in" ? checkIn : checkOut

  const distanceM = fix
    ? distanceInMetres(fix, { lat: task.lat, lng: task.lng })
    : null
  const inside = distanceM !== null && distanceM <= task.radiusM
  const needsReason = distanceM !== null && !inside

  function submit() {
    if (!fix || mutation.isPending) return

    if (needsReason && reason.trim().length < 3) {
      setReasonError("Say why you're checking in from outside the area")
      return
    }

    mutation.mutate(
      { ...fix, reason: needsReason ? reason.trim() : undefined },
      {
        onSuccess: () => {
          toast.success(
            mode === "in"
              ? `Checked in at ${task.site}`
              : `Checked out of ${task.site}`
          )
          onClose()
        },
        onError: (error) =>
          reportMutationError(error, (path, message) => {
            if (path === "reason") setReasonError(message)
          }),
      }
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        {locating ? (
          <div className="border-n-200 flex flex-col gap-2 rounded-[10px] border bg-white p-3.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-36" />
            <span className="text-n-500 mt-1 text-[12.5px]">Finding you…</span>
          </div>
        ) : locationError ? (
          <div className="border-s-overdue rounded-[10px] border bg-white p-3.5">
            <p className="text-s-overdue m-0 text-[13.5px] leading-relaxed">
              {locationError}
            </p>
            <button
              type="button"
              onClick={retry}
              className="border-n-300 text-n-700 hover:bg-n-100 mt-3 rounded-md border bg-white px-3 py-2 text-[13px] font-semibold"
            >
              Try again
            </button>
          </div>
        ) : fix && distanceM !== null ? (
          <div
            className={cn(
              "flex flex-col gap-1 rounded-[10px] border p-3.5",
              inside ? "border-p-400 bg-p-50" : "border-a-400 bg-a-50"
            )}
          >
            <span
              className={cn(
                "font-mono text-[10.5px] tracking-[0.06em]",
                inside ? "text-p-600" : "text-a-700"
              )}
            >
              {inside ? "INSIDE THE CHECK-IN AREA" : "OUTSIDE THE AREA"}
            </span>
            <span
              className={cn(
                "text-[17px] font-semibold",
                inside ? "text-p-700" : "text-a-900"
              )}
            >
              {formatDistance(distanceM)} from {task.site}
            </span>
            <span className="text-n-500 text-[12.5px]">
              Area is {formatDistance(task.radiusM)} · your GPS is accurate to
              about {formatDistance(fix.accuracyM)}
            </span>
          </div>
        ) : null}

        {needsReason ? (
          <label className="flex flex-col gap-[7px]">
            <span className="text-n-600 text-[12.5px] font-semibold tracking-[0.05em] uppercase">
              Why are you outside the area?
            </span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setReasonError(null)
              }}
              placeholder="Gate is locked, checking in from the road"
              aria-invalid={Boolean(reasonError)}
              className={cn(inputClass, "min-h-[76px] resize-y")}
            />
            {reasonError ? (
              <span className="text-s-overdue text-[12.5px]">{reasonError}</span>
            ) : (
              <span className="text-n-400 text-[12px]">
                Your owner sees this next to the check-in.
              </span>
            )}
          </label>
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
          disabled={!fix || mutation.isPending}
          className={cn(
            "rounded-md px-[18px] py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-[1.06] disabled:opacity-60",
            mode === "in" ? "bg-p-500" : "bg-n-700"
          )}
        >
          {mutation.isPending
            ? "Sending…"
            : mode === "in"
              ? "Check in"
              : "Check out"}
        </button>
      </DialogFooter>
    </>
  )
}

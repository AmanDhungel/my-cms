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
import { reportMutationError, useTaskStatus } from "@/lib/queries"
import type { TaskDTO } from "@/models/task"

type Next = "in_progress" | "blocked" | "done"

const CHOICES: { value: Next; label: string; hint: string }[] = [
  { value: "in_progress", label: "In progress", hint: "Working on it now" },
  { value: "blocked", label: "Blocked", hint: "Waiting on something" },
  { value: "done", label: "Completed", hint: "Finished, nothing left" },
]

export function StatusDialog({
  task,
  open,
  onClose,
}: {
  task: TaskDTO
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
            {task.title}
          </DialogDescription>
        </DialogHeader>
        {/* Remounted on each open, so the form never shows stale input. */}
        {open ? <Body task={task} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ task, onClose }: { task: TaskDTO; onClose: () => void }) {
  const [choice, setChoice] = React.useState<Next>(
    task.status === "in_progress" ? "blocked" : "in_progress",
  )
  const [reason, setReason] = React.useState(task.blockedReason ?? "")
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const mutation = useTaskStatus(task.id)

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
            disabled={option.value === task.status}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors disabled:opacity-45",
              choice === option.value
                ? "border-p-400 bg-p-50"
                : "border-n-200 hover:bg-n-100 bg-white",
            )}
          >
            <span className="text-[14px] font-semibold">{option.label}</span>
            <span className="text-n-500 text-[12.5px]">
              {option.value === task.status ? "Current status" : option.hint}
            </span>
          </button>
        ))}

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

        {choice === "done" && task.checkedInAt ? (
          <p className="text-n-500 m-0 text-[12.5px] leading-relaxed">
            You&rsquo;re still checked in — finishing will check you out too.
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

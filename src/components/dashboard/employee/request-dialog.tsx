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
import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { reportMutationError, useCreateRequest, useTasks } from "@/lib/queries"
import { requestSchemaChecked } from "@/lib/validations/work"
import type { RequestKind } from "@/lib/work-constants"

const KINDS: { value: RequestKind; label: string; hint: string }[] = [
  { value: "leave", label: "Leave", hint: "Time off, with dates" },
  { value: "advance", label: "Advance", hint: "Money before payday" },
  { value: "material", label: "Material", hint: "Something you need on site" },
]

type Errors = Partial<Record<string, string>>

export function RequestDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[480px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            New request
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Your owner sees this straight away and decides.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from a blank form. */}
        {open ? <Body onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = React.useState<RequestKind>("leave")
  const [message, setMessage] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [taskId, setTaskId] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})

  const mutation = useCreateRequest()
  // Only fetched once the material tab is actually opened.
  const tasks = useTasks("today")

  function submit() {
    if (mutation.isPending) return

    const payload =
      kind === "leave"
        ? { kind, message, startDate, endDate }
        : kind === "advance"
          ? { kind, message, amount }
          : { kind, message, taskId: taskId || undefined }

    const parsed = requestSchemaChecked.safeParse(payload)

    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        toast.success("Request sent to your owner")
        onClose()
      },
      onError: (error) =>
        reportMutationError(error, (path, msg) =>
          setErrors((prev) => ({ ...prev, [path]: msg })),
        ),
    })
  }

  return (
    <>
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto pr-0.5">
        <div className="flex gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setKind(option.value)
                setErrors({})
              }}
              aria-pressed={kind === option.value}
              className={cn(
                "flex-1 rounded-md border px-2.5 py-2.5 text-[13px] transition-colors",
                kind === option.value
                  ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                  : "border-n-300 text-n-700 hover:bg-n-100 bg-white font-medium",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-n-400 m-0 -mt-2 text-[12px]">
          {KINDS.find((option) => option.value === kind)?.hint}
        </p>

        {kind === "leave" ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>From</FieldLabel>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                className={inputClass}
              />
              <FieldError message={errors.startDate} />
            </label>
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>To</FieldLabel>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                className={inputClass}
              />
              <FieldError message={errors.endDate} />
            </label>
          </div>
        ) : null}

        {kind === "advance" ? (
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Amount</FieldLabel>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="5000"
              aria-invalid={Boolean(errors.amount)}
              className={cn(inputClass, "font-mono")}
            />
            <FieldError message={errors.amount} />
          </label>
        ) : null}

        {kind === "material" ? (
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>For which task?</FieldLabel>
            <select
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Not task specific</option>
              {(tasks.data?.tasks ?? []).map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} · {task.site}
                </option>
              ))}
            </select>
            {tasks.isPending ? (
              <span className="text-n-400 text-[12px]">
                Loading today&rsquo;s tasks…
              </span>
            ) : null}
            <FieldError message={errors.taskId} />
          </label>
        ) : null}

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Details</FieldLabel>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              kind === "leave"
                ? "Family function in Pokhara"
                : kind === "advance"
                  ? "Rent is due before payday"
                  : "Two more rolls of pallet wrap for Bay 3"
            }
            aria-invalid={Boolean(errors.message)}
            className={cn(inputClass, "min-h-[80px] resize-y")}
          />
          <FieldError message={errors.message} />
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
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending ? "Sending…" : "Send request"}
        </button>
      </DialogFooter>
    </>
  )
}

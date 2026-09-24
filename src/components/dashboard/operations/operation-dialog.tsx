"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
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
import { KIND_COPY } from "@/lib/operations"
import {
  reportMutationError,
  useCreateOperation,
  useCustomers,
  usePeople,
  useProjects,
  useUpdateOperation,
} from "@/lib/queries"
import { operationSchema } from "@/lib/validations/operations"
import {
  OPERATION_STATUSES,
  TICKET_PRIORITIES,
  type OperationKind,
} from "@/lib/work-constants"
import type { OperationDTO } from "@/models/operation"

type Errors = Partial<Record<string, string>>

/**
 * One dialog behind all four kinds. What changes between them is the wording
 * and whether the date carries a time — the record underneath is the same.
 */
export function OperationDialog({
  open,
  kind,
  entry,
  onClose,
}: {
  open: boolean
  kind: OperationKind
  /** Present when editing. */
  entry?: OperationDTO
  onClose: () => void
}) {
  const copy = KIND_COPY[kind]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[560px] sm:p-6"
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {entry ? `Edit ${copy.singular.toLowerCase()}` : `New ${copy.singular.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {copy.subtitle}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from the record as it
            stands rather than from whatever was typed last time. */}
        {open ? (
          <Body kind={kind} entry={entry} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  kind,
  entry,
  onClose,
}: {
  kind: OperationKind
  entry?: OperationDTO
  onClose: () => void
}) {
  const copy = KIND_COPY[kind]
  const [form, setForm] = React.useState(() => blank(kind, entry))
  const [errors, setErrors] = React.useState<Errors>({})

  const people = usePeople()
  const projects = useProjects("active")
  const customers = useCustomers()

  const create = useCreateOperation()
  const update = useUpdateOperation(entry?.id ?? "")
  const mutation = entry ? update : create

  function set<K extends keyof ReturnType<typeof blank>>(
    key: K,
    value: ReturnType<typeof blank>[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleAssignee(id: string) {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(id)
        ? prev.assigneeIds.filter((one) => one !== id)
        : [...prev.assigneeIds, id],
    }))
  }

  function submit() {
    if (mutation.isPending) return

    const parsed = operationSchema.safeParse({
      kind,
      title: form.title,
      details: form.details || undefined,
      // A whole-day entry is stored at midday, so a reader in any nearby zone
      // still sees the day that was picked.
      startAt: form.allDay
        ? `${form.startDate}T12:00`
        : `${form.startDate}T${form.startTime || "09:00"}`,
      endAt:
        form.allDay || !form.endTime
          ? undefined
          : `${form.startDate}T${form.endTime}`,
      allDay: form.allDay,
      status: form.status,
      priority: form.priority,
      assigneeIds: form.assigneeIds,
      customerId: form.customerId || undefined,
      projectId: form.projectId || undefined,
      location: form.location || undefined,
    })

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
        toast.success(
          entry ? `${form.title} updated` : `${copy.singular} added`
        )
        onClose()
      },
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>What is it</FieldLabel>
          <input
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder={placeholderFor(kind)}
            aria-invalid={Boolean(errors.title)}
            className={inputClass}
          />
          <FieldError message={errors.title} />
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>{copy.allDayByDefault ? "Date" : "Day"}</FieldLabel>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => set("startDate", event.target.value)}
              aria-label="Date"
              aria-invalid={Boolean(errors.startAt)}
              className={inputClass}
            />
            <FieldError message={errors.startAt} />
          </label>

          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Time</FieldLabel>
            <label className="flex items-center gap-2 pt-1.5">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(event) => set("allDay", event.target.checked)}
                className="size-[15px]"
              />
              <span className="text-n-600 text-[13px]">
                All day — no particular hour
              </span>
            </label>
          </div>
        </div>

        {form.allDay ? null : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Starts</FieldLabel>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => set("startTime", event.target.value)}
                aria-label="Start time"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Ends</FieldLabel>
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => set("endTime", event.target.value)}
                aria-label="End time"
                aria-invalid={Boolean(errors.endAt)}
                className={inputClass}
              />
              <FieldError message={errors.endAt} />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Where</FieldLabel>
          <input
            value={form.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder="A site, a room, or a video link"
            className={inputClass}
          />
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Customer</FieldLabel>
            <select
              value={form.customerId}
              onChange={(event) => set("customerId", event.target.value)}
              aria-label="Customer"
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Nobody in particular</option>
              {(customers.data?.customers ?? []).map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Project</FieldLabel>
            <select
              value={form.projectId}
              onChange={(event) => set("projectId", event.target.value)}
              aria-label="Project"
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">No project</option>
              {(projects.data?.projects ?? []).map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>State</FieldLabel>
            <select
              value={form.status}
              onChange={(event) =>
                set("status", event.target.value as typeof form.status)
              }
              aria-label="State"
              className={cn(inputClass, "cursor-pointer")}
            >
              {OPERATION_STATUSES.map((one) => (
                <option key={one} value={one}>
                  {copy.states[one]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Priority</FieldLabel>
            <select
              value={form.priority}
              onChange={(event) =>
                set("priority", event.target.value as typeof form.priority)
              }
              aria-label="Priority"
              className={cn(inputClass, "cursor-pointer capitalize")}
            >
              {TICKET_PRIORITIES.map((one) => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Who is on it</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {(people.data?.members ?? []).map((member) => {
              const on = form.assigneeIds.includes(member.id)
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleAssignee(member.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    on
                      ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                      : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                  )}
                >
                  {member.name}
                </button>
              )
            })}
          </div>
          {people.data?.members.length === 0 ? (
            <span className="text-n-500 text-[12.5px]">
              Nobody on the crew yet — invite someone from People.
            </span>
          ) : null}
        </div>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={form.details}
            onChange={(event) => set("details", event.target.value)}
            placeholder="Optional — what it is about, what to bring"
            className={cn(inputClass, "min-h-[72px] resize-y")}
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
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending
            ? "Saving…"
            : entry
              ? "Save changes"
              : `Add ${copy.singular.toLowerCase()}`}
        </button>
      </DialogFooter>
    </>
  )
}

function placeholderFor(kind: OperationKind) {
  if (kind === "meeting") return "e.g. Site walk-through with Balaju Traders"
  if (kind === "installation") return "e.g. Fit the switchboard at Bhaktapur"
  if (kind === "follow_up") return "e.g. Call about the pending payment"
  return "e.g. VAT return filed"
}

/** The form's shape, seeded from an existing entry when editing one. */
function blank(kind: OperationKind, entry?: OperationDTO) {
  const start = entry ? new Date(entry.startAt) : new Date()
  const end = entry?.endAt ? new Date(entry.endAt) : null

  return {
    title: entry?.title ?? "",
    details: entry?.details ?? "",
    startDate: localDate(start),
    startTime: localTime(start),
    endTime: end ? localTime(end) : "",
    allDay: entry ? entry.allDay : KIND_COPY[kind].allDayByDefault,
    status: entry?.status ?? ("scheduled" as OperationDTO["status"]),
    priority: entry?.priority ?? ("normal" as OperationDTO["priority"]),
    assigneeIds: entry?.assignees.map((one) => one.id) ?? [],
    customerId: entry?.customer?.id ?? "",
    projectId: entry?.project?.id ?? "",
    location: entry?.location ?? "",
  }
}

/** `<input type="date">` wants the viewer's own calendar date, not UTC. */
function localDate(at: Date) {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

function localTime(at: Date) {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

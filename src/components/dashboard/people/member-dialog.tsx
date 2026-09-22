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
import { reportMutationError, useUpdateMember } from "@/lib/queries"
import { ShiftPicker } from "@/components/dashboard/shift-picker"
import {
  WeekEditor,
  WeekSummary,
} from "@/components/dashboard/week-editor"
import { describeWeek, type WeekPattern } from "@/lib/week"
import { memberUpdateSchema, splitShift } from "@/lib/validations/auth"
import type { UserDTO } from "@/models/user"

type Errors = Partial<Record<string, string>>

/** Editing one person's record. The owner's own row is read-only here. */
export function MemberDialog({
  member,
  isWorkspaceOwner,
  workspaceWeek,
  open,
  onClose,
}: {
  member: UserDTO
  isWorkspaceOwner: boolean
  /** The standard week, so the dialog can show what they are following. */
  workspaceWeek: WeekPattern | null
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
            Edit {member.name.split(" ")[0]}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {member.email} · they keep signing in with this address.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Body
            member={member}
            isWorkspaceOwner={isWorkspaceOwner}
            workspaceWeek={workspaceWeek}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  member,
  isWorkspaceOwner,
  workspaceWeek,
  onClose,
}: {
  member: UserDTO
  isWorkspaceOwner: boolean
  /** The standard week, shown when this person just follows it. */
  workspaceWeek: WeekPattern | null
  onClose: () => void
}) {
  const [name, setName] = React.useState(member.name)
  const [phone, setPhone] = React.useState(member.phone)
  const [role, setRole] = React.useState(member.role)
  const initial = splitShift(member.shift)
  const [shiftStart, setShiftStart] = React.useState(initial.shiftStart)
  const [shiftEnd, setShiftEnd] = React.useState(initial.shiftEnd)
  // Null means they follow the workspace's standard week.
  const [week, setWeek] = React.useState<WeekPattern | null>(member.week)
  const [ownWeek, setOwnWeek] = React.useState(Boolean(member.week))
  const [errors, setErrors] = React.useState<Errors>({})

  const mutation = useUpdateMember(member.id)

  function submit() {
    if (mutation.isPending) return

    const parsed = memberUpdateSchema.safeParse({
      name,
      phone,
      role,
      shiftStart: role === "owner" ? undefined : shiftStart,
      shiftEnd: role === "owner" ? undefined : shiftEnd,
      // Null puts them back on the workspace's week; a value overrides it.
      week: ownWeek ? week : null,
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
        toast.success("Saved")
        onClose()
      },
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path]: message }))
        ),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Full name</FieldLabel>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
          />
          <FieldError message={errors.name} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Phone</FieldLabel>
          <input
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
              setErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            aria-invalid={Boolean(errors.phone)}
            className={cn(inputClass, "font-mono")}
          />
          <FieldError message={errors.phone} />
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Role</FieldLabel>
            <select
              value={role}
              disabled={isWorkspaceOwner}
              onChange={(event) =>
                setRole(event.target.value as UserDTO["role"])
              }
              className={cn(
                inputClass,
                "cursor-pointer",
                isWorkspaceOwner && "bg-n-100 text-n-600"
              )}
            >
              {isWorkspaceOwner ? <option value="owner">Owner</option> : null}
              <option value="supervisor">Supervisor</option>
              <option value="employee">Employee</option>
            </select>
            {isWorkspaceOwner ? (
              <span className="text-n-400 text-[12px]">
                The workspace owner&rsquo;s role is fixed.
              </span>
            ) : null}
            <FieldError message={errors.role} />
          </label>

        </div>

        <ShiftPicker
          start={shiftStart}
          end={shiftEnd}
          disabled={role === "owner"}
          onStart={(value) => {
            setShiftStart(value)
            setErrors((prev) => ({ ...prev, shiftEnd: undefined }))
          }}
          onEnd={(value) => {
            setShiftEnd(value)
            setErrors((prev) => ({ ...prev, shiftEnd: undefined }))
          }}
          error={errors.shiftEnd ?? errors.shiftStart}
        />

        {role === "owner" ? null : (
          <div className="flex flex-col gap-2.5">
            <FieldLabel>Their week</FieldLabel>

            <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
              {[
                { own: false, label: "Follows the standard week" },
                { own: true, label: "Has their own" },
              ].map((option) => (
                <button
                  key={String(option.own)}
                  type="button"
                  aria-pressed={ownWeek === option.own}
                  onClick={() => {
                    setOwnWeek(option.own)
                    if (option.own && !week) setWeek(workspaceWeek ?? null)
                  }}
                  className={cn(
                    "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors",
                    ownWeek === option.own
                      ? "bg-p-100 text-p-700 font-semibold"
                      : "text-n-600 hover:bg-n-100 font-medium"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {ownWeek ? (
              <WeekEditor
                value={week}
                onChange={setWeek}
                suggestFrom={workspaceWeek ?? `${shiftStart}–${shiftEnd}`}
              />
            ) : (
              <>
                <WeekSummary week={workspaceWeek ?? null} />
                <span className="text-n-500 text-[12px]">
                  {workspaceWeek
                    ? describeWeek(workspaceWeek)
                    : "Set one in Organization settings and everyone picks it up."}
                </span>
              </>
            )}
            <FieldError message={errors.week} />
          </div>
        )}
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
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </DialogFooter>
    </>
  )
}

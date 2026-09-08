"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ApiRequestError, apiFetch } from "@/lib/api-client"
import {
  SHIFTS,
  inviteSchema,
  type InviteValues,
} from "@/lib/validations/auth"
import type { InviteDTO } from "@/models/invite"

type InviteResponse = { invite: InviteDTO; joinUrl: string }

export function InviteDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean
  onClose: () => void
  onSent: () => void
}) {
  const [issued, setIssued] = React.useState<InviteResponse | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "employee",
      shift: SHIFTS[0],
      message: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (values: InviteValues) =>
      apiFetch<InviteResponse>("/api/invites", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (data) => {
      setIssued(data)
      reset()
      onSent()
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
          setError(path as keyof InviteValues, { message: messages[0] })
        }
        toast.error(error.message)
        return
      }
      toast.error("Could not reach the server")
    },
  })

  function close() {
    setIssued(null)
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite employee"
      className="fixed inset-0 z-80 flex items-center justify-center bg-[rgba(27,24,21,0.45)] p-4 sm:p-8"
    >
      <div className="border-n-300 bg-n-50 flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border shadow-[0_24px_60px_rgba(27,24,21,0.3)] [animation:ems-view-in_.22s_cubic-bezier(.2,.7,.2,1)_both]">
        <div className="border-n-200 flex items-start justify-between gap-4 border-b px-[22px] py-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading m-0 text-[19px] font-semibold tracking-[-0.01em]">
              {issued ? "Invite ready" : "Invite employee"}
            </h2>
            <p className="text-n-500 m-0 text-[13.5px]">
              {issued
                ? "The link works once and expires in seven days."
                : "They join with a single link — no open sign-up exists."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-n-500 hover:bg-n-100 rounded-md px-1.5 text-[22px] leading-none"
          >
            ×
          </button>
        </div>

        {issued ? (
          <IssuedLink data={issued} onDone={close} />
        ) : (
          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex flex-col gap-4 overflow-auto px-[22px] py-5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>Full name</FieldLabel>
                  <input
                    placeholder="Kiran Basnet"
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass}
                    {...register("name")}
                  />
                  <FieldError message={errors.name?.message} />
                </label>
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    type="tel"
                    placeholder="+977 98•• •• ••"
                    aria-invalid={Boolean(errors.phone)}
                    className={cn(inputClass, "font-mono")}
                    {...register("phone")}
                  />
                  <FieldError message={errors.phone?.message} />
                </label>
              </div>

              <label className="flex flex-col gap-[7px]">
                <FieldLabel>Work email</FieldLabel>
                <input
                  type="email"
                  placeholder="kiran@company.com"
                  aria-invalid={Boolean(errors.email)}
                  className={inputClass}
                  {...register("email")}
                />
                <span className="text-n-400 text-[12px]">
                  Required — it&rsquo;s how they sign in afterwards.
                </span>
                <FieldError message={errors.email?.message} />
              </label>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>Role</FieldLabel>
                  <select
                    className={cn(inputClass, "cursor-pointer")}
                    {...register("role")}
                  >
                    <option value="employee">Employee</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </label>
                <label className="flex flex-col gap-[7px]">
                  <FieldLabel>Shift</FieldLabel>
                  <select
                    className={cn(inputClass, "cursor-pointer")}
                    {...register("shift")}
                  >
                    {SHIFTS.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-[7px]">
                <FieldLabel>Message</FieldLabel>
                <textarea
                  placeholder="Optional note shown on the join page"
                  className={cn(inputClass, "min-h-[70px] resize-y")}
                  {...register("message")}
                />
                <FieldError message={errors.message?.message} />
              </label>
            </div>

            <div className="border-n-200 bg-n-100 flex items-center justify-between gap-3 border-t px-[22px] py-3.5">
              <span className="text-n-500 font-mono text-[11px]">
                LINK EXPIRES IN 7 DAYS
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={close}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white shadow-[0_3px_10px_rgba(14,124,123,0.24)] hover:brightness-[1.06] disabled:opacity-60"
                >
                  {mutation.isPending ? "Creating…" : "Create invite"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function IssuedLink({
  data,
  onDone,
}: {
  data: InviteResponse
  onDone: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.joinUrl)
      setCopied(true)
      toast.success("Link copied")
    } catch {
      toast.error("Copy failed — select the link and copy it manually")
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <p className="text-n-600 m-0 text-[14px] leading-relaxed">
          Send this to <strong className="font-semibold">{data.invite.name}</strong>{" "}
          at {data.invite.email}. It is shown once — only a hash of it is stored,
          so it can&rsquo;t be read back later.
        </p>
        <div className="border-n-300 flex flex-col gap-2 rounded-md border bg-white p-3">
          <code className="text-n-800 font-mono text-[12.5px] break-all">
            {data.joinUrl}
          </code>
        </div>
        <button
          type="button"
          onClick={copy}
          className="bg-p-500 self-start rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="border-n-200 bg-n-100 flex justify-end border-t px-[22px] py-3.5">
        <button
          type="button"
          onClick={onDone}
          className="border-n-300 text-n-700 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  )
}

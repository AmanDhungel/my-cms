"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ApiRequestError, apiFetch } from "@/lib/api-client"
import type { PendingInvite } from "@/lib/auth/invites"
import {
  acceptInviteSchema,
  type AcceptInviteValues,
} from "@/lib/validations/auth"
import type { UserDTO } from "@/models/user"

export function JoinForm({
  token,
  invite,
}: {
  token: string
  invite: PendingInvite
}) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: "", terms: false },
  })

  async function onSubmit(values: AcceptInviteValues) {
    try {
      await apiFetch<{ user: UserDTO }>(`/api/invites/${token}/accept`, {
        method: "POST",
        body: JSON.stringify(values),
      })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
          setError(path as keyof AcceptInviteValues, { message: messages[0] })
        }
        toast.error(error.message)
        return
      }
      toast.error("Could not reach the server")
      return
    }

    // The account exists now; sign in with the password just set.
    const result = await signIn("credentials", {
      email: invite.email,
      password: values.password,
      redirect: false,
    })

    if (result?.error) {
      toast.error("Account created — log in to continue")
      router.push("/login")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[26px]">
      <div className="flex flex-col gap-2">
        <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
          Invite · {invite.role}
        </p>
        <h1 className="font-heading text-[30px] font-bold tracking-[-0.015em]">
          Join {invite.businessName}
        </h1>
        <p className="text-n-600 text-[14.5px] leading-relaxed">
          Set a password and you&rsquo;re on the crew. Shift {invite.shift}.
        </p>
      </div>

      {invite.message ? (
        <p className="border-a-400 bg-a-50 text-a-900 rounded-md border-l-2 px-4 py-3 text-[13.5px] leading-[1.6]">
          {invite.message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Name</FieldLabel>
          <input
            readOnly
            value={invite.name}
            className={`${inputClass} text-n-600 bg-n-100`}
          />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Work email</FieldLabel>
          <input
            readOnly
            value={invite.email}
            className={`${inputClass} text-n-600 bg-n-100`}
          />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Choose a password</FieldLabel>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            aria-invalid={Boolean(errors.password)}
            className={inputClass}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </label>

        <label className="text-n-600 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.55]">
          <input
            type="checkbox"
            className="accent-p-500 mt-0.5 size-[15px]"
            {...register("terms")}
          />
          I agree to the terms and to my location being recorded when I check in
          to a task.
        </label>
        <FieldError message={errors.terms?.message} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-p-500 mt-1 rounded-md px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(14,124,123,0.22)] transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] disabled:opacity-60"
        >
          Join the crew
        </button>
      </form>

      <div className="border-n-300 flex flex-col gap-2.5 border-t border-dashed pt-1.5">
        <p className="text-n-600 text-sm">
          Wrong person?{" "}
          <Link href="/" className="font-semibold">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  )
}

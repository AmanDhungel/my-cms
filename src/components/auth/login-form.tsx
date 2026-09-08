"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ApiRequestError, apiFetch } from "@/lib/api-client"
import { loginSchema, type LoginValues } from "@/lib/validations/auth"
import type { UserDTO } from "@/models/user"

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  })

  async function onSubmit(values: LoginValues) {
    try {
      const { user } = await apiFetch<{ user: UserDTO }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      })
      // The session cookie is set. Redirect here once a dashboard exists.
      toast.success(`Welcome back, ${user.name}.`)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(
          error.fieldErrors ?? {}
        )) {
          setError(path as keyof LoginValues, { message: messages[0] })
        }
        toast.error(error.message)
        return
      }
      toast.error("Could not reach the server")
    }
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-[26px]">
      <div className="flex flex-col gap-2">
        <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
          Sign in
        </p>
        <h1 className="font-heading text-[30px] font-bold tracking-[-0.015em]">
          Log in to your workspace
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Work email</FieldLabel>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Password</FieldLabel>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className={inputClass}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </label>

        <div className="flex items-center justify-between gap-3">
          <label className="text-n-600 flex cursor-pointer items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              className="accent-p-500 size-[15px]"
              {...register("remember")}
            />
            Keep me signed in
          </label>
          <Link href="/login" className="text-[13.5px] font-medium">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-p-500 mt-1 rounded-md px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(14,124,123,0.22)] transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] disabled:opacity-60"
        >
          Log in
        </button>
      </form>

      <div className="flex items-center gap-3">
        <span className="bg-n-200 h-px flex-1" />
        <span className="text-n-400 font-mono text-[11px] tracking-[0.06em]">
          OR
        </span>
        <span className="bg-n-200 h-px flex-1" />
      </div>

      <button
        type="button"
        onClick={() => toast.info("Invite links land with the auth API.")}
        className="border-n-300 text-p-700 hover:bg-n-100 rounded-md border bg-white px-5 py-3 text-[14.5px] font-semibold transition-colors"
      >
        Continue with an invite link
      </button>

      <div className="border-n-300 flex flex-col gap-2.5 border-t border-dashed pt-1.5">
        <p className="text-n-600 text-sm">
          New here?{" "}
          <Link href="/signup" className="font-semibold">
            Create a workspace
          </Link>
        </p>
        <Link href="/" className="text-n-500 text-[13.5px]">
          ← Back to site
        </Link>
      </div>
    </div>
  )
}

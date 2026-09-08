"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cn } from "cn"

import {
  FieldError,
  FieldLabel,
  fieldLabelClass,
  inputClass,
} from "@/components/auth/field"
import { ApiRequestError, apiFetch } from "@/lib/api-client"
import {
  CREW_SIZES,
  signupSchema,
  type SignupValues,
} from "@/lib/validations/auth"
import type { BusinessDTO } from "@/models/business"
import type { UserDTO } from "@/models/user"

export function SignupForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      business: "",
      name: "",
      phone: "",
      email: "",
      password: "",
      crewSize: "1–10",
      terms: false,
    },
  })

  const crewSize = useWatch({ control, name: "crewSize" })

  async function onSubmit(values: SignupValues) {
    let business: BusinessDTO

    try {
      ;({ business } = await apiFetch<{
        user: UserDTO
        business: BusinessDTO
      }>("/api/register", {
        method: "POST",
        body: JSON.stringify(values),
      }))
    } catch (error) {
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(
          error.fieldErrors ?? {}
        )) {
          setError(path as keyof SignupValues, { message: messages[0] })
        }
        toast.error(error.message)
        return
      }
      toast.error("Could not reach the server")
      return
    }

    // The workspace exists; sign the owner in with what they just typed.
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (!result || result.error) {
      toast.success(`${business.name} is ready — log in to continue.`)
      router.push("/login")
      return
    }

    // Step 2 (inviting the crew) lives on the dashboard's People page.
    router.push("/dashboard/people")
    router.refresh()
  }

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
          Step 1 of 2 · Workspace
        </p>
        <h1 className="font-heading text-[30px] font-bold tracking-[-0.015em]">
          Create your workspace
        </h1>
        <p className="text-n-600 text-[14.5px] leading-relaxed">
          You&rsquo;ll be the owner. Invite the crew right after.
        </p>
      </div>

      <div aria-hidden className="flex gap-2.5">
        <span className="bg-p-500 h-[3px] flex-1 rounded-full" />
        <span className="bg-n-200 h-[3px] flex-1 rounded-full" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Business name</FieldLabel>
          <input
            placeholder="Balaju Logistics"
            aria-invalid={Boolean(errors.business)}
            className={inputClass}
            {...register("business")}
          />
          <FieldError message={errors.business?.message} />
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Your name</FieldLabel>
            <input
              autoComplete="name"
              placeholder="Riya Shrestha"
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
              autoComplete="tel"
              placeholder="+977 98••••••"
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
            autoComplete="new-password"
            placeholder="At least 10 characters"
            aria-invalid={Boolean(errors.password)}
            className={inputClass}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className={fieldLabelClass}>Crew size</legend>
          <div className="flex gap-2">
            {CREW_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={crewSize === size}
                onClick={() =>
                  setValue("crewSize", size, { shouldValidate: true })
                }
                className={cn(
                  "flex-1 rounded-md border px-3 py-2.5 text-[13.5px] transition-colors",
                  crewSize === size
                    ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                    : "border-n-300 text-n-700 hover:bg-n-100 bg-white font-medium"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-n-600 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.55]">
          <input
            type="checkbox"
            className="accent-p-500 mt-0.5 size-[15px]"
            {...register("terms")}
          />
          I agree to the terms and to location data being recorded at task
          check-in.
        </label>
        <FieldError message={errors.terms?.message} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-a-400 text-a-900 mt-0.5 rounded-md px-5 py-3.5 text-[15px] font-semibold shadow-[0_4px_14px_rgba(200,127,15,0.24)] transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] disabled:opacity-60"
        >
          Continue to invites
        </button>
      </form>

      <div className="border-n-300 flex flex-col gap-2.5 border-t border-dashed pt-1.5">
        <p className="text-n-600 text-sm">
          Already have a workspace?{" "}
          <Link href="/login" className="font-semibold">
            Log in
          </Link>
        </p>
        <Link href="/" className="text-n-500 text-[13.5px]">
          ← Back to site
        </Link>
      </div>
    </div>
  )
}

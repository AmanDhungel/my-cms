"use client"

import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { initialsOf } from "@/components/dashboard/viewer"
import {
  DashboardMain,
  PageHeading,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import { ApiRequestError, apiFetch } from "@/lib/api-client"
import {
  CREW_SIZES,
  businessSettingsSchema,
  type BusinessSettingsValues,
} from "@/lib/validations/auth"
import type { BusinessDTO } from "@/models/business"
import type { UserDTO } from "@/models/user"

export function SettingsView({
  business,
  me,
  canEdit,
  stats,
}: {
  business: BusinessDTO
  me: UserDTO
  canEdit: boolean
  stats: { members: number; pendingInvites: number }
}) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<BusinessSettingsValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: business.name,
      crewSize: business.crewSize as BusinessSettingsValues["crewSize"],
    },
  })

  const mutation = useMutation({
    mutationFn: (values: BusinessSettingsValues) =>
      apiFetch<{ business: BusinessDTO }>("/api/business", {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: ({ business: saved }) => {
      reset({
        name: saved.name,
        crewSize: saved.crewSize as BusinessSettingsValues["crewSize"],
      })
      toast.success("Workspace updated")
      router.refresh()
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
          setError(path as keyof BusinessSettingsValues, {
            message: messages[0],
          })
        }
        toast.error(error.message)
        return
      }
      toast.error("Could not reach the server")
    },
  })

  return (
    <DashboardMain className="max-w-[980px] gap-[22px] pb-16">
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <PageHeading
          eyebrow="Account"
          title="Organization settings"
          subtitle="Applies to every project unless a task overrides it."
          actions={
            canEdit ? (
              <>
                <button
                  type="button"
                  onClick={() => reset()}
                  disabled={!isDirty || mutation.isPending}
                  className={secondaryButtonClass}
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || mutation.isPending}
                  className={primaryButtonClass}
                >
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : null
          }
        />

        <Panel className="mt-[22px] grid gap-6 p-[22px] lg:grid-cols-[210px_1fr]">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-heading m-0 text-base font-semibold">
              Business profile
            </h2>
            <p className="text-n-500 m-0 text-[13px] leading-[1.55]">
              Shown to employees in the app and on exported reports.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="font-heading bg-p-100 text-p-700 flex size-[52px] items-center justify-center rounded-xl text-[17px] font-semibold"
              >
                {initialsOf(business.name)}
              </span>
              <span className="text-n-400 font-mono text-[11px] tracking-[0.05em]">
                INITIALS ARE DERIVED FROM THE NAME
              </span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="flex flex-col gap-[7px]">
                <FieldLabel>Business name</FieldLabel>
                <input
                  disabled={!canEdit}
                  aria-invalid={Boolean(errors.name)}
                  className={cn(inputClass, !canEdit && "bg-n-100 text-n-600")}
                  {...register("name")}
                />
                <FieldError message={errors.name?.message} />
              </label>

              <label className="flex flex-col gap-[7px]">
                <FieldLabel>Crew size</FieldLabel>
                <select
                  disabled={!canEdit}
                  className={cn(
                    inputClass,
                    "cursor-pointer",
                    !canEdit && "bg-n-100 text-n-600"
                  )}
                  {...register("crewSize")}
                >
                  {CREW_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.crewSize?.message} />
              </label>
            </div>
          </div>
        </Panel>
      </form>

      <Panel className="grid gap-6 p-[22px] lg:grid-cols-[210px_1fr]">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading m-0 text-base font-semibold">
            Joining this workspace
          </h2>
          <p className="text-n-500 m-0 text-[13px] leading-[1.55]">
            There is no open sign-up. This is enforced server side, not just in
            the UI.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Row
            label="Members"
            value={`${stats.members}`}
            hint="Every one of them accepted an invite, except the owner who created the workspace."
          />
          <Row
            label="Invites pending"
            value={`${stats.pendingInvites}`}
            hint="Links that have been created but not used yet."
          />
          <Row
            label="Link lifetime"
            value="7 days"
            hint="One use per link. Only a SHA-256 hash of it is stored."
          />
        </div>
      </Panel>

      <Panel className="grid gap-6 p-[22px] lg:grid-cols-[210px_1fr]">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading m-0 text-base font-semibold">
            Your account
          </h2>
          <p className="text-n-500 m-0 text-[13px] leading-[1.55]">
            The identity behind everything you approve.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Row label="Name" value={me.name} />
          <Row label="Email" value={me.email} hint="This is your sign-in." />
          <Row label="Phone" value={me.phone} />
          <Row label="Role" value={me.role} />
        </div>
      </Panel>
    </DashboardMain>
  )
}

function Row({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border bg-white px-[15px] py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {hint ? (
          <span className="text-n-500 text-[12.5px]">{hint}</span>
        ) : null}
      </span>
      <span className="text-n-700 font-mono text-[13px] capitalize">
        {value}
      </span>
    </div>
  )
}

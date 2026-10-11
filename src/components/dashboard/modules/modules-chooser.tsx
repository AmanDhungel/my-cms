"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { toast } from "sonner"

import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { primaryButtonClass } from "@/components/dashboard/ui"
import {
  ALL_MODULES_ON,
  MODULE_KEYS,
  chooserSections,
  enabledList,
  type ModuleState,
} from "@/lib/modules"
import { reportMutationError, useSaveModules } from "@/lib/queries"

/**
 * "Use everything" or "Choose what I need", then which sections.
 *
 * The same form asks once on the first visit (FirstRunModules) and sits in
 * Organization settings afterwards (SectionsPanel). The pages listed on each
 * card come from the sidebar's own config, so the two can't disagree.
 */
export function ModulesChooser({
  role,
  initial,
  submitLabel,
  onSaved,
}: {
  role: string
  /** What is on now; `null` for a workspace that has never chosen. */
  initial: ModuleState | null
  submitLabel: string
  onSaved?: () => void
}) {
  const router = useRouter()
  const save = useSaveModules()
  const startsCustom =
    initial !== null && MODULE_KEYS.some((key) => !initial[key])
  const [mode, setMode] = useState<"all" | "custom">(
    startsCustom ? "custom" : "all"
  )
  const [picked, setPicked] = useState<ModuleState>(
    initial ?? { ...ALL_MODULES_ON }
  )
  const sections = chooserSections(role)
  const chosen = mode === "all" ? [...MODULE_KEYS] : enabledList(picked)
  const nothingPicked = mode === "custom" && chosen.length === 0

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (nothingPicked || save.isPending) return
    save.mutate(chosen, {
      onSuccess: () => {
        toast.success("Sections saved")
        onSaved?.()
        // The sidebar and dashboard are rendered on the server from this.
        router.refresh()
      },
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="How do you want to use EMS?"
        className="grid gap-3 sm:grid-cols-2"
      >
        <ModeCard
          checked={mode === "all"}
          onSelect={() => setMode("all")}
          title="Use everything"
          description="Projects, operations, sales & stock, and reports."
        />
        <ModeCard
          checked={mode === "custom"}
          onSelect={() => setMode("custom")}
          title="Choose what I need"
          description="Turn on only the sections you use. The rest stay out of the way."
        />
      </div>

      {mode === "custom" ? (
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="text-n-500 mb-2 font-mono text-[10.5px] tracking-[0.07em]">
            SECTIONS
          </legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {sections.map((section) => {
              const on = picked[section.module]
              return (
                <label
                  key={section.module}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 transition-colors",
                    on
                      ? "border-p-400 bg-p-100"
                      : "border-n-300 hover:bg-n-100 bg-white"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) =>
                      setPicked((current) => ({
                        ...current,
                        [section.module]: event.target.checked,
                      }))
                    }
                    className="accent-p-500 mt-0.5 size-4"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13.5px] font-semibold">
                      {section.label}
                    </span>
                    <span className="text-n-600 text-[12.5px] leading-[1.45]">
                      {section.blurb}
                    </span>
                    <span className="text-n-500 text-[12px] leading-[1.45]">
                      {section.pages.join(" · ")}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          {nothingPicked ? (
            <p role="alert" className="text-s-overdue m-0 text-[12.5px]">
              Pick at least one section.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <p className="text-n-500 m-0 text-[12.5px] leading-[1.5]">
        Dashboard, Notifications and Organization settings are always available.
        You can change this anytime in Organization settings.
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={nothingPicked || save.isPending}
          className={primaryButtonClass}
        >
          {save.isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  )
}

function ModeCard({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-4 transition-colors",
        checked
          ? "border-p-400 bg-p-100"
          : "border-n-300 hover:bg-n-100 bg-white"
      )}
    >
      <input
        type="radio"
        name="modules-mode"
        checked={checked}
        onChange={onSelect}
        className="accent-p-500 mt-0.5 size-4"
      />
      <span className="flex flex-col gap-1">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-n-600 text-[12.5px] leading-[1.45]">
          {description}
        </span>
      </span>
    </label>
  )
}

/**
 * The first visit after sign-up (or after this shipped): shown instead of
 * the dashboard until the owner has chosen once. Rendered by the dashboard
 * layout on the server, so the full sidebar never flashes up first.
 */
export function FirstRunModules({
  role,
  businessName,
}: {
  role: string
  businessName: string
}) {
  return (
    <div className="bg-n-50 flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <div className="border-n-200 flex w-full max-w-[720px] flex-col gap-6 rounded-[16px] border bg-white p-5 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <p className="text-p-600 m-0 font-mono text-[11.5px] tracking-[0.08em] uppercase">
            {businessName}
          </p>
          <h1 className="font-heading m-0 text-[24px] font-bold tracking-[-0.015em]">
            How do you want to use EMS?
          </h1>
          <p className="text-n-600 m-0 text-[14px]">
            Keep the whole app, or switch on only the parts your business needs.
          </p>
        </div>
        <ModulesChooser role={role} initial={null} submitLabel="Continue" />
        <div className="border-n-200 flex justify-end border-t pt-4">
          {/* The shell (and its sign-out) is not shown until a choice is made. */}
          <SignOutButton className="text-n-600 hover:text-n-800 text-[13px] font-semibold" />
        </div>
      </div>
    </div>
  )
}

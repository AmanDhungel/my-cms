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
import { reportMutationError, useCreateProject } from "@/lib/queries"
import { projectSchema } from "@/lib/validations/work"
import type { ProjectDTO } from "@/models/project"

type Errors = Partial<Record<string, string>>

/**
 * Used on its own from the Projects page, and nested inside New task so an
 * owner who has no projects yet can make one without losing the form.
 */
export function ProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (project: ProjectDTO) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[480px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            New project
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            A project groups the tasks that belong to one job or site.
          </DialogDescription>
        </DialogHeader>
        {open ? <Body onClose={onClose} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: (project: ProjectDTO) => void
}) {
  const [name, setName] = React.useState("")
  const [site, setSite] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})

  const mutation = useCreateProject()

  function submit() {
    if (mutation.isPending) return

    const parsed = projectSchema.safeParse({
      name,
      site: site || undefined,
      description: description || undefined,
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
      onSuccess: ({ project }) => {
        toast.success(`${project.name} created`)
        onCreated?.(project)
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
          <FieldLabel>Project name</FieldLabel>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            placeholder="Balaju depot upgrade"
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
          />
          <FieldError message={errors.name} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Default site</FieldLabel>
          <input
            value={site}
            onChange={(event) => setSite(event.target.value)}
            placeholder="e.g. Balaju Industrial Area"
            className={inputClass}
          />
          <span className="text-n-400 text-[12px]">
            Optional. Pre-fills the site on tasks in this project.
          </span>
          <FieldError message={errors.site} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this project covers"
            className={cn(inputClass, "min-h-[72px] resize-y")}
          />
          <FieldError message={errors.description} />
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
          {mutation.isPending ? "Creating…" : "Create project"}
        </button>
      </DialogFooter>
    </>
  )
}

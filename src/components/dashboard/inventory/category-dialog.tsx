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
import {
  reportMutationError,
  useCreateCategory,
  useUpdateCategory,
} from "@/lib/queries"
import { categorySchema } from "@/lib/validations/inventory"
import type { CategoryDTO } from "@/models/inventory-category"

type Errors = Partial<Record<string, string>>

/**
 * Used from the Categories tab, and nested inside New item so an owner with
 * no categories yet can make one without losing what they have typed.
 */
export function CategoryDialog({
  open,
  onClose,
  onCreated,
  category,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (category: CategoryDTO) => void
  /** Present when editing an existing category. */
  category?: CategoryDTO
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[460px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {category ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Categories group the stock you hold — cables, tools, safety gear.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from the category as
            it stands rather than from whatever was typed last time. */}
        {open ? (
          <Body onClose={onClose} onCreated={onCreated} category={category} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  onCreated,
  category,
}: {
  onClose: () => void
  onCreated?: (category: CategoryDTO) => void
  category?: CategoryDTO
}) {
  const [name, setName] = React.useState(category?.name ?? "")
  const [description, setDescription] = React.useState(
    category?.description ?? ""
  )
  const [errors, setErrors] = React.useState<Errors>({})

  const create = useCreateCategory()
  const update = useUpdateCategory(category?.id ?? "")
  const mutation = category ? update : create

  function submit() {
    if (mutation.isPending) return

    const parsed = categorySchema.safeParse({
      name,
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
      onSuccess: (result) => {
        toast.success(
          category
            ? `${result.category.name} updated`
            : `${result.category.name} added`
        )
        if (!category) onCreated?.(result.category)
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
          <FieldLabel>Category name</FieldLabel>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            placeholder="e.g. Cables"
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
          />
          <FieldError message={errors.name} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in here"
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
          {mutation.isPending
            ? "Saving…"
            : category
              ? "Save changes"
              : "Add category"}
        </button>
      </DialogFooter>
    </>
  )
}

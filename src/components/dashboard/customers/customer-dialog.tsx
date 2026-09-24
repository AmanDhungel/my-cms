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
  useCreateCustomer,
  useUpdateCustomer,
} from "@/lib/queries"
import { customerSchema } from "@/lib/validations/customers"
import type { CustomerDTO } from "@/models/customer"

type Errors = Partial<Record<string, string>>

/**
 * Used from the Customers page, and nested inside New bill so a walk-in can
 * be saved without losing the bill being written.
 */
export function CustomerDialog({
  open,
  onClose,
  onCreated,
  customer,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (customer: CustomerDTO) => void
  /** Present when editing an existing customer. */
  customer?: CustomerDTO
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[520px] sm:p-6"
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {customer ? "Edit customer" : "New customer"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Saved once, then picked on every bill you raise for them.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from the record as
            it stands rather than from whatever was typed last time. */}
        {open ? (
          <Body onClose={onClose} onCreated={onCreated} customer={customer} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  onCreated,
  customer,
}: {
  onClose: () => void
  onCreated?: (customer: CustomerDTO) => void
  customer?: CustomerDTO
}) {
  const [form, setForm] = React.useState(() => blank(customer))
  const [errors, setErrors] = React.useState<Errors>({})

  const create = useCreateCustomer()
  const update = useUpdateCustomer(customer?.id ?? "")
  const mutation = customer ? update : create

  function set(key: keyof ReturnType<typeof blank>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function submit() {
    if (mutation.isPending) return

    const parsed = customerSchema.safeParse({
      name: form.name,
      kind: form.kind,
      company: form.company || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      location: form.location || undefined,
      pan: form.pan || undefined,
      note: form.note || undefined,
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
          customer
            ? `${result.customer.name} updated`
            : `${result.customer.name} added`
        )
        if (!customer) onCreated?.(result.customer)
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
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Name</FieldLabel>
            <input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Sunil Maharjan"
              aria-invalid={Boolean(errors.name)}
              className={inputClass}
            />
            <FieldError message={errors.name} />
          </label>

          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Which are they</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["customer", "Customer"],
                  ["vendor", "Supplier"],
                  ["both", "Both"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("kind", value)}
                  aria-pressed={form.kind === value}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    form.kind === value
                      ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                      : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-n-500 text-[11.5px]">
              Decides where they can be picked — on a bill, on an expense, or
              on both.
            </span>
          </div>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Company</FieldLabel>
            <input
              value={form.company}
              onChange={(event) => set("company", event.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
            <FieldError message={errors.company} />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Phone</FieldLabel>
            <input
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+977 98•• ••• •••"
              className={inputClass}
            />
            <FieldError message={errors.phone} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Email</FieldLabel>
            <input
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(errors.email)}
              className={inputClass}
            />
            <FieldError message={errors.email} />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Location</FieldLabel>
            <input
              value={form.location}
              onChange={(event) => set("location", event.target.value)}
              placeholder="Balaju, Kathmandu"
              className={inputClass}
            />
            <FieldError message={errors.location} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>PAN</FieldLabel>
            <input
              value={form.pan}
              onChange={(event) => set("pan", event.target.value)}
              placeholder="Optional — printed on a tax invoice"
              className={inputClass}
            />
            <FieldError message={errors.pan} />
          </label>
        </div>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Note</FieldLabel>
          <textarea
            value={form.note}
            onChange={(event) => set("note", event.target.value)}
            placeholder="Optional — payment terms, who to ask for"
            className={cn(inputClass, "min-h-[64px] resize-y")}
          />
          <FieldError message={errors.note} />
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
            : customer
              ? "Save changes"
              : "Add customer"}
        </button>
      </DialogFooter>
    </>
  )
}

function blank(customer?: CustomerDTO) {
  return {
    name: customer?.name ?? "",
    kind: customer?.kind ?? "customer",
    company: customer?.company ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    location: customer?.location ?? "",
    pan: customer?.pan ?? "",
    note: customer?.note ?? "",
  }
}

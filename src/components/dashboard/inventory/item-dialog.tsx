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
import { CategoryDialog } from "@/components/dashboard/inventory/category-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  reportMutationError,
  useCreateItem,
  useInventoryCategories,
  useUpdateItem,
} from "@/lib/queries"
import { itemSchema } from "@/lib/validations/inventory"
import { ITEM_UNITS, type ItemUnit } from "@/lib/work-constants"
import type { ItemDTO } from "@/models/inventory-item"

type Errors = Partial<Record<string, string>>

/** Pass `item` to edit it; leave it out to add a new one. */
export function ItemDialog({
  open,
  onClose,
  item,
}: {
  open: boolean
  onClose: () => void
  item?: ItemDTO
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[560px] sm:p-6"
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {item ? "Edit item" : "New item"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            What it is, what it costs, and how much of it you hold right now.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from the item as it
            stands rather than from whatever was typed last time. */}
        {open ? <Body onClose={onClose} item={item} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ onClose, item }: { onClose: () => void; item?: ItemDTO }) {
  const [form, setForm] = React.useState(() => blank(item))
  const [errors, setErrors] = React.useState<Errors>({})
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false)

  const categories = useInventoryCategories()
  const create = useCreateItem()
  const update = useUpdateItem(item?.id ?? "")
  const mutation = item ? update : create

  const list = categories.data?.categories ?? []
  const noCategories = !categories.isPending && list.length === 0

  function set<K extends keyof ReturnType<typeof blank>>(
    key: K,
    value: ReturnType<typeof blank>[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function submit() {
    if (mutation.isPending) return

    const parsed = itemSchema.safeParse({
      name: form.name,
      sku: form.sku || undefined,
      categoryId: form.categoryId,
      description: form.description || undefined,
      unit: form.unit,
      // An empty box means none of it, not a missing answer.
      price: form.price || 0,
      stock: form.stock || 0,
      lowStockAt: form.lowStockAt || 0,
      location: form.location || undefined,
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
          item ? `${result.item.name} updated` : `${result.item.name} added`
        )
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
          <FieldLabel>Item name</FieldLabel>
          <input
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. 2.5mm copper cable"
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
          />
          <FieldError message={errors.name} />
        </label>

        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Category</FieldLabel>
            <button
              type="button"
              onClick={() => setCategoryDialogOpen(true)}
              className="text-p-600 text-[12.5px] font-semibold"
            >
              + New category
            </button>
          </div>

          {categories.isPending ? (
            <Skeleton className="h-11 w-full rounded-md" />
          ) : noCategories ? (
            <div className="border-a-400 bg-a-50 flex flex-col items-start gap-2.5 rounded-md border p-3.5">
              <p className="text-a-900 m-0 text-[13px] leading-relaxed">
                There are no categories yet, and every item belongs to one.
                Create the first one and it will be selected here.
              </p>
              <button
                type="button"
                onClick={() => setCategoryDialogOpen(true)}
                className="bg-a-400 text-a-900 rounded-md px-3 py-2 text-[13px] font-semibold hover:brightness-[1.06]"
              >
                Add a category
              </button>
            </div>
          ) : (
            <select
              value={form.categoryId}
              onChange={(event) => set("categoryId", event.target.value)}
              aria-invalid={Boolean(errors.categoryId)}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Pick a category</option>
              {list.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <FieldError message={errors.categoryId} />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Unit</FieldLabel>
            <select
              value={form.unit}
              onChange={(event) => set("unit", event.target.value as ItemUnit)}
              className={cn(inputClass, "cursor-pointer")}
            >
              {ITEM_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Price</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => set("price", event.target.value)}
              placeholder="0"
              aria-invalid={Boolean(errors.price)}
              className={inputClass}
            />
            <FieldError message={errors.price} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>In stock</FieldLabel>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={form.stock}
              onChange={(event) => set("stock", event.target.value)}
              placeholder="0"
              aria-invalid={Boolean(errors.stock)}
              className={inputClass}
            />
            <FieldError message={errors.stock} />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Low stock at</FieldLabel>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={form.lowStockAt}
              onChange={(event) => set("lowStockAt", event.target.value)}
              placeholder="0"
              aria-invalid={Boolean(errors.lowStockAt)}
              className={inputClass}
            />
            <span className="text-n-400 text-[12px]">
              Flagged as running out at or below this.
            </span>
            <FieldError message={errors.lowStockAt} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Item code</FieldLabel>
            <input
              value={form.sku}
              onChange={(event) => set("sku", event.target.value)}
              placeholder="Optional, e.g. CBL-025"
              aria-invalid={Boolean(errors.sku)}
              className={inputClass}
            />
            <FieldError message={errors.sku} />
          </label>
        </div>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Kept at</FieldLabel>
          <input
            value={form.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder="Optional, e.g. Balaju store — rack 2"
            className={inputClass}
          />
          <FieldError message={errors.location} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Anything the crew should know about it"
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
          {mutation.isPending ? "Saving…" : item ? "Save changes" : "Add item"}
        </button>
      </DialogFooter>

      {/* Nested, so a missing category can be added without losing the form. */}
      <CategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onCreated={(category) => set("categoryId", category.id)}
      />
    </>
  )
}

function blank(item?: ItemDTO) {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    categoryId: item?.category?.id ?? "",
    description: item?.description ?? "",
    unit: (item?.unit ?? "pcs") as ItemUnit,
    price: item ? String(item.price) : "",
    stock: item ? String(item.stock) : "",
    lowStockAt: item ? String(item.lowStockAt) : "",
    location: item?.location ?? "",
  }
}

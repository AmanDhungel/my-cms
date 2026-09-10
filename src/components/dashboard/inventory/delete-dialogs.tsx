"use client"

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
import {
  reportMutationError,
  useDeleteCategory,
  useDeleteItem,
} from "@/lib/queries"
import type { CategoryWithCount } from "@/lib/queries"
import type { ItemDTO } from "@/models/inventory-item"

/**
 * Inventory rows are the one thing in the app that really is deleted — no
 * check-in or attendance record points at them — so both of these ask first.
 */
export function DeleteItemDialog({
  item,
  open,
  onClose,
}: {
  item: ItemDTO
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeleteItem(item.id)

  return (
    <ConfirmShell
      open={open}
      onClose={onClose}
      title={`Delete ${item.name}?`}
      description={item.category?.name ?? "Uncategorised"}
      body={`This removes the item and the stock count of ${item.stock} ${item.unit} held against it. It can't be undone.`}
      confirmLabel="Delete item"
      pendingLabel="Deleting…"
      pending={mutation.isPending}
      onConfirm={() => {
        if (mutation.isPending) return
        mutation.mutate(undefined, {
          onSuccess: () => {
            toast.success(`${item.name} deleted`)
            onClose()
          },
          onError: (error) => reportMutationError(error),
        })
      }}
    />
  )
}

export function DeleteCategoryDialog({
  category,
  open,
  onClose,
}: {
  category: CategoryWithCount
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeleteCategory(category.id)
  const holds = category.items

  return (
    <ConfirmShell
      open={open}
      onClose={onClose}
      title={`Delete ${category.name}?`}
      description={`${holds} item${holds === 1 ? "" : "s"} filed here`}
      body={
        holds > 0
          ? `${category.name} still holds ${holds} item${holds === 1 ? "" : "s"}. Move ${holds === 1 ? "it" : "them"} to another category, or delete ${holds === 1 ? "it" : "them"} first.`
          : "Nothing is filed under it, so nothing else changes."
      }
      confirmLabel="Delete category"
      pendingLabel="Deleting…"
      pending={mutation.isPending}
      // A category with items in it can't go; the server refuses too.
      disabled={holds > 0}
      onConfirm={() => {
        if (mutation.isPending) return
        mutation.mutate(undefined, {
          onSuccess: () => {
            toast.success(`${category.name} deleted`)
            onClose()
          },
          onError: (error) => reportMutationError(error),
        })
      }}
    />
  )
}

function ConfirmShell({
  open,
  onClose,
  title,
  description,
  body,
  confirmLabel,
  pendingLabel,
  pending,
  disabled,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  body: string
  confirmLabel: string
  pendingLabel: string
  pending: boolean
  disabled?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {description}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">{body}</p>

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
            onClick={onConfirm}
            disabled={pending || disabled}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

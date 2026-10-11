"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { CustomerDialog } from "@/components/dashboard/customers/customer-dialog"
import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  LineItemsEditor,
  Total,
  blankLine,
  draftFromLines,
  linePercent,
  type DraftLine,
  type Group,
} from "@/components/dashboard/sales/line-items-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { quantity, totalsOf } from "@/lib/billing"
import { DEFAULT_VALIDITY_DAYS, addDays } from "@/lib/estimates"
import {
  reportMutationError,
  useCustomers,
  useInventoryItems,
  useSaveEstimate,
} from "@/lib/queries"
import { estimateSchema } from "@/lib/validations/estimates"
import type { BillSource } from "@/lib/work-constants"
import type { CustomerDTO } from "@/models/customer"
import type { EstimateDTO } from "@/models/estimate"

type Errors = Partial<Record<string, string>>

/**
 * A new estimate, or changes to one. The same line editor as a sale
 * (line-items-editor.tsx), a validity date (15 days by default) and notes /
 * terms. Saving moves nothing: no stock, no money, no balance.
 */
export function EstimateDialog({
  open,
  onClose,
  editing,
  vatRate,
  today,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editing?: EstimateDTO | null
  vatRate: number
  today: string
  onSaved?: (estimate: EstimateDTO) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[880px] sm:p-6")}
      >
        {open ? (
          <Body onClose={onClose} editing={editing ?? null} vatRate={vatRate} today={today} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  editing,
  vatRate,
  today,
  onSaved,
}: {
  onClose: () => void
  editing: EstimateDTO | null
  vatRate: number
  today: string
  onSaved?: (estimate: EstimateDTO) => void
}) {
  const [source, setSource] = React.useState<BillSource | null>(editing?.source ?? null)

  if (!source) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">New estimate</DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            A priced offer. It moves no stock and no money until you convert it into a sale.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {(
            [
              ["custom", "Custom estimate", "Type each item, its price and how many."],
              ["inventory", "From inventory", "Pick items you hold; prices come from the item."],
            ] as const
          ).map(([key, title, blurb]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className="border-n-300 hover:border-p-400 hover:bg-p-100/40 flex flex-col gap-2 rounded-xl border bg-white p-4 text-left transition-colors"
            >
              <span className="font-heading text-[15.5px] font-semibold">{title}</span>
              <span className="text-n-600 text-[13px] leading-relaxed">{blurb}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
        </DialogFooter>
      </>
    )
  }

  return (
    <Editor
      source={source}
      editing={editing}
      vatRate={vatRate}
      today={today}
      onBack={editing ? undefined : () => setSource(null)}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function Editor({
  source,
  editing,
  vatRate,
  today,
  onBack,
  onClose,
  onSaved,
}: {
  source: BillSource
  editing: EstimateDTO | null
  vatRate: number
  today: string
  onBack?: () => void
  onClose: () => void
  onSaved?: (estimate: EstimateDTO) => void
}) {
  const fromInventory = source === "inventory"
  const [start] = React.useState(() => (editing ? draftFromLines(editing.lines) : null))
  const [customerId, setCustomerId] = React.useState(editing?.customerId ?? "")
  const [customer, setCustomer] = React.useState({
    name: editing?.customer.name ?? "",
    phone: editing?.customer.phone ?? "",
    email: editing?.customer.email ?? "",
    address: editing?.customer.address ?? "",
    pan: editing?.customer.pan ?? "",
  })
  const [lines, setLines] = React.useState<DraftLine[]>(
    start?.lines ?? (fromInventory ? [] : [blankLine()])
  )
  const [groups, setGroups] = React.useState<Group[]>(start?.groups ?? [])
  const [withVat, setWithVat] = React.useState((editing?.vatRate ?? 0) > 0)
  const [validUntil, setValidUntil] = React.useState(
    editing?.validUntil ?? addDays(today, DEFAULT_VALIDITY_DAYS)
  )
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [errors, setErrors] = React.useState<Errors>({})
  const [newParty, setNewParty] = React.useState(false)

  const stock = useInventoryItems(fromInventory)
  const customers = useCustomers()
  const save = useSaveEstimate(editing?.id)
  const saved = customers.data?.customers ?? []
  const available = stock.data?.items ?? []

  const priced = lines.map((line) => ({
    price: Number(line.price) || 0,
    qty: Number(line.qty) || 0,
    discountPct: linePercent(groups, line.key),
  }))
  const totals = totalsOf(priced, withVat ? vatRate : 0)

  function adopt(party: CustomerDTO) {
    setCustomerId(party.id)
    setCustomer({
      name: party.name,
      phone: party.phone ?? "",
      email: party.email ?? "",
      address: party.location ?? "",
      pan: party.pan ?? "",
    })
    setErrors((prev) => ({ ...prev, "customer.name": undefined }))
  }

  function submit(send: boolean) {
    if (save.isPending) return
    const parsed = estimateSchema.safeParse({
      source,
      customerId: customerId || undefined,
      customer: {
        name: customer.name,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
        address: customer.address || undefined,
        pan: customer.pan || undefined,
      },
      lines: lines.map((line) => ({
        itemId: line.itemId,
        name: line.name,
        unit: line.unit || "pcs",
        price: line.price || 0,
        qty: line.qty || 0,
        discountPct: linePercent(groups, line.key),
      })),
      withVat,
      note: note || undefined,
      validUntil,
      send,
    })
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "root"
        next[path.startsWith("lines") ? "lines" : path] ??= issue.message
      }
      setErrors(next)
      return
    }
    save.mutate(parsed.data, {
      onSuccess: ({ estimate }) => {
        toast.success(
          editing
            ? `${estimate.number} saved`
            : send
              ? `${estimate.number} saved and marked sent`
              : `${estimate.number} saved as a draft`
        )
        onSaved?.(estimate)
        onClose()
      },
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path.startsWith("lines") ? "lines" : path]: message }))
        ),
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading flex flex-wrap items-center gap-2.5 text-[19px] font-semibold">
          {editing ? `Edit ${editing.number}` : "New estimate"}
          <span className="border-p-200 bg-p-100 text-p-700 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium">
            {fromInventory ? "from inventory" : "custom"}
          </span>
          {onBack ? (
            <button type="button" onClick={onBack} className="text-p-600 text-[12.5px] font-semibold">
              change
            </button>
          ) : null}
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          A priced offer — nothing moves until you convert it into a sale.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Party</FieldLabel>
              <button
                type="button"
                onClick={() => setNewParty(true)}
                className="text-p-600 text-[12.5px] font-semibold"
              >
                + Add party
              </button>
            </div>
            {customers.isPending ? (
              <Skeleton className="h-11 w-full rounded-md" />
            ) : (
              <select
                autoFocus
                value={customerId}
                onChange={(event) => {
                  const party = saved.find((entry) => entry.id === event.target.value)
                  if (party) adopt(party)
                  else setCustomerId("")
                }}
                aria-label="Party"
                className={cn(inputClass, "cursor-pointer")}
              >
                <option value="">Not a saved party — type below</option>
                {saved.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.company ? ` · ${entry.company}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>For</FieldLabel>
              <input
                value={customer.name}
                onChange={(event) => {
                  setCustomer((prev) => ({ ...prev, name: event.target.value }))
                  setCustomerId("")
                  setErrors((prev) => ({ ...prev, "customer.name": undefined }))
                }}
                placeholder="Who is this estimate for"
                aria-invalid={Boolean(errors["customer.name"])}
                className={inputClass}
              />
              <FieldError message={errors["customer.name"]} />
            </label>
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Phone</FieldLabel>
              <input
                value={customer.phone}
                onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Optional — needed to share on WhatsApp"
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <LineItemsEditor
          fromInventory={fromInventory}
          lines={lines}
          setLines={setLines}
          groups={groups}
          setGroups={setGroups}
          available={available}
          stockPending={stock.isPending}
          error={errors.lines}
          onEdit={() => setErrors((prev) => ({ ...prev, lines: undefined }))}
        />

        <section className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Valid until</FieldLabel>
            <input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              aria-invalid={Boolean(errors.validUntil)}
              className={inputClass}
            />
            <span className="text-n-500 text-[11.5px]">
              After this day it shows as Expired until you extend it.
            </span>
            <FieldError message={errors.validUntil} />
          </label>
          <label className="border-n-200 flex items-start gap-2.5 self-start rounded-[10px] border bg-white p-3">
            <input
              type="checkbox"
              checked={withVat}
              onChange={(event) => setWithVat(event.target.checked)}
              className="accent-p-500 mt-0.5 size-4"
            />
            <span className="text-[13.5px] font-semibold">Charge VAT at {quantity(vatRate)}%</span>
          </label>
          <label className="flex flex-col gap-[7px] sm:col-span-2">
            <FieldLabel>Notes and terms</FieldLabel>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. 50% advance, rest on delivery. Prices include installation."
              className={cn(inputClass, "min-h-[64px] resize-y")}
            />
          </label>
        </section>
      </div>

      {/* Totals stay in view while the lines scroll. */}
      <div className="border-n-200 bg-n-50 sticky -bottom-5 z-10 -mx-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:-bottom-6 sm:-mx-6 sm:px-6">
        <div className="flex min-w-[220px] flex-col gap-1">
          <Total label="Subtotal" value={totals.subtotal} />
          {totals.discountTotal > 0 ? <Total label="Discount" value={-totals.discountTotal} /> : null}
          {withVat ? <Total label={`VAT ${quantity(vatRate)}%`} value={totals.vatAmount} /> : null}
          <Total label="Total" value={totals.total} strong />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={save.isPending}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {editing ? "Save" : "Save draft"}
          </button>
          {!editing || editing.status === "draft" ? (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={save.isPending}
              className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save and mark sent"}
            </button>
          ) : null}
        </div>
      </div>

      <CustomerDialog open={newParty} onClose={() => setNewParty(false)} onCreated={adopt} />
    </>
  )
}

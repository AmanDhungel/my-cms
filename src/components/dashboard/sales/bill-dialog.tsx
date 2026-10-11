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
import { CustomerDialog } from "@/components/dashboard/customers/customer-dialog"
import { PaymentPicker } from "@/components/dashboard/sales/payment"
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
  ReceivedNow,
  emptyReceived,
  receivedPayload,
  validateReceived,
  type ReceivedDraft,
} from "@/components/dashboard/sales/received-now"
import {
  rememberAccount,
  useAccountFor,
  useCanSeeAccounts,
} from "@/components/dashboard/money-pickers"
import { Skeleton } from "@/components/ui/skeleton"
import {
  reportMutationError,
  useCreateBill,
  useCustomers,
  useInventoryItems,
} from "@/lib/queries"
import { quantity, totalsOf } from "@/lib/billing"
import { billSchema } from "@/lib/validations/sales"
import type { BillPayment, BillSource } from "@/lib/work-constants"
import type { BillDTO } from "@/models/bill"
import type { CustomerDTO } from "@/models/customer"

type Errors = Partial<Record<string, string>>

/**
 * A sale started from an estimate ("Convert to sale"). Built on the server
 * from the saved estimate — never from anything the browser sent — with
 * stock items priced from the inventory as any sale is. Quantities and the
 * payment can still be changed before it is saved.
 */
export type BillPrefill = {
  estimateId: string
  estimateNumber: string
  source: BillSource
  customerId: string | null
  customer: { name: string; phone: string; email: string; address: string; pan: string }
  lines: { itemId: string | null; name: string; unit: string; price: number; qty: number; discountPct: number }[]
  withVat: boolean
  note: string
}

export function BillDialog({
  open,
  onClose,
  onCreated,
  vatRate,
  today,
  prefill,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
  vatRate: number
  /** The workspace's today, for the due date. */
  today?: string
  /** Start from an estimate instead of a blank sheet. */
  prefill?: BillPrefill
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[880px] sm:p-6"
        )}
      >
        {/* Mounted only while open, so every bill starts from a clean sheet. */}
        {open ? (
          <Body
            onClose={onClose}
            onCreated={onCreated}
            vatRate={vatRate}
            today={today ?? new Date().toISOString().slice(0, 10)}
            prefill={prefill}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  onCreated,
  vatRate,
  today,
  prefill,
}: {
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
  vatRate: number
  today: string
  prefill?: BillPrefill
}) {
  const [source, setSource] = React.useState<BillSource | null>(
    prefill?.source ?? null
  )

  if (!source) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            New bill
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Two ways to build one. Pick where the lines come from.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <SourceCard
            title="Custom bill"
            blurb="Type what you sold: the item, its price per piece and how many. Nothing is taken from stock."
            onPick={() => setSource("custom")}
          />
          <SourceCard
            title="Inventory bill"
            blurb="Pick items you hold. The price comes from the item, you only enter the quantity, and the stock goes down."
            onPick={() => setSource("inventory")}
          />
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
      key={source}
      source={source}
      vatRate={vatRate}
      today={today}
      prefill={prefill}
      onBack={() => setSource(null)}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function SourceCard({
  title,
  blurb,
  onPick,
}: {
  title: string
  blurb: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="border-n-300 hover:border-p-400 hover:bg-p-100/40 flex flex-col gap-2 rounded-xl border bg-white p-4 text-left transition-colors"
    >
      <span className="font-heading text-[15.5px] font-semibold">{title}</span>
      <span className="text-n-600 text-[13px] leading-relaxed">{blurb}</span>
    </button>
  )
}

function Editor({
  source,
  vatRate,
  today,
  prefill,
  onBack,
  onClose,
  onCreated,
}: {
  source: BillSource
  vatRate: number
  today: string
  prefill?: BillPrefill
  onBack: () => void
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
}) {
  const fromInventory = source === "inventory"

  // From an estimate: its party, lines, discounts and notes, ready to adjust.
  const [fromEstimate] = React.useState(() =>
    prefill ? draftFromLines(prefill.lines) : null
  )
  const [customer, setCustomer] = React.useState(
    prefill?.customer ?? {
      name: "",
      phone: "",
      email: "",
      address: "",
      pan: "",
    }
  )
  const [lines, setLines] = React.useState<DraftLine[]>(
    fromEstimate?.lines ?? (fromInventory ? [] : [blankLine()])
  )
  const [groups, setGroups] = React.useState<Group[]>(fromEstimate?.groups ?? [])
  const [withVat, setWithVat] = React.useState(prefill?.withVat ?? false)
  const [payment, setPayment] = React.useState<BillPayment>("unpaid")
  const [chequeNo, setChequeNo] = React.useState("")
  const [note, setNote] = React.useState(prefill?.note ?? "")
  const [errors, setErrors] = React.useState<Errors>({})
  const [customerId, setCustomerId] = React.useState(prefill?.customerId ?? "")
  const [customerDialogOpen, setCustomerDialogOpen] = React.useState(false)
  // Money taken at the till, and when the rest is due (received-now.tsx).
  const [received, setReceived] = React.useState<ReceivedDraft>(emptyReceived)
  // The account last used with how the money came in, else the default one.
  const fallbackAccount = useAccountFor(
    payment === "cheque" ? "cheque" : received.method
  )
  const canSeeAccounts = useCanSeeAccounts()

  const stock = useInventoryItems(fromInventory)
  const customers = useCustomers()
  const create = useCreateBill()
  const saved = customers.data?.customers ?? []

  /** Picking one fills the bill's own copy of their details. */
  function chooseCustomer(id: string) {
    setCustomerId(id)
    const picked = saved.find((entry) => entry.id === id)
    if (!picked) return
    setCustomer({
      name: picked.name,
      phone: picked.phone ?? "",
      email: picked.email ?? "",
      address: picked.location ?? "",
      pan: picked.pan ?? "",
    })
    setErrors((prev) => ({ ...prev, "customer.name": undefined }))
  }

  function adopt(created: CustomerDTO) {
    // The list has not refetched yet, so fill from what came back.
    setCustomerId(created.id)
    setCustomer({
      name: created.name,
      phone: created.phone ?? "",
      email: created.email ?? "",
      address: created.location ?? "",
      pan: created.pan ?? "",
    })
  }

  const available = stock.data?.items ?? []

  /** A line's discount is the percentage of whichever group holds it. */
  const percentOf = (key: string) => linePercent(groups, key)

  const priced = lines.map((line) => ({
    price: Number(line.price) || 0,
    qty: Number(line.qty) || 0,
    discountPct: percentOf(line.key),
  }))

  const totals = totalsOf(priced, withVat ? vatRate : 0)

  function submit() {
    if (create.isPending) return

    const payload = {
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
        discountPct: percentOf(line.key),
      })),
      withVat,
      payment,
      chequeNo: chequeNo || undefined,
      note: note || undefined,
      ...receivedPayload(payment, totals.total, received, fallbackAccount),
      // Converting: the server flips the estimate in the same transaction.
      estimateId: prefill?.estimateId,
    }

    const parsed = billSchema.safeParse(payload)

    const next: Errors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "root"
        // Every line problem reads as one message above the table.
        next[path.startsWith("lines") ? "lines" : path] ??= issue.message
      }
    }
    // The account rules for the money taken now, checked before sending.
    Object.assign(
      next,
      validateReceived(payment, totals.total, received, {
        fallbackAccountId: fallbackAccount,
        requireAccount: canSeeAccounts,
      })
    )
    if (!parsed.success || Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    create.mutate(parsed.data, {
      onSuccess: ({ bill }) => {
        const taken = parsed.data.received
        if (taken) {
          rememberAccount(taken.method, taken.accountId ?? taken.allocations?.[0]?.accountId)
        }
        toast.success(`${bill.number} raised`)
        onCreated?.(bill)
        onClose()
      },
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({
            ...prev,
            [path.startsWith("lines") ? "lines" : path]: message,
          }))
        ),
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading flex flex-wrap items-center gap-2.5 text-[19px] font-semibold">
          New bill
          {prefill ? (
            <span className="border-s-progress/40 text-s-progress rounded-full border bg-[#eef4fd] px-2.5 py-0.5 text-[11.5px] font-medium">
              from {prefill.estimateNumber}
            </span>
          ) : null}
          <span className="border-p-200 bg-p-100 text-p-700 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium">
            {fromInventory ? "from inventory" : "custom"}
          </span>
          {/* A sale from an estimate keeps the estimate's kind of lines. */}
          {prefill ? null : (
            <button
              type="button"
              onClick={onBack}
              className="text-p-600 text-[12.5px] font-semibold"
            >
              change
            </button>
          )}
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          {fromInventory
            ? "Prices come from stock, and saving this takes the quantities off it."
            : "Type the item, its price per piece and the quantity."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        {/* ---- customer ---- */}
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Saved customer</FieldLabel>
              <button
                type="button"
                onClick={() => setCustomerDialogOpen(true)}
                className="text-p-600 text-[12.5px] font-semibold"
              >
                + New customer
              </button>
            </div>
            {customers.isPending ? (
              <Skeleton className="h-11 w-full rounded-md" />
            ) : (
              <select
                value={customerId}
                onChange={(event) => chooseCustomer(event.target.value)}
                aria-label="Saved customer"
                className={cn(inputClass, "cursor-pointer")}
              >
                <option value="">Not a saved customer — type below</option>
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
              <FieldLabel>Customer</FieldLabel>
              <input
                value={customer.name}
                onChange={(event) => {
                  setCustomer((prev) => ({ ...prev, name: event.target.value }))
                  // Renaming by hand means this is somebody else now.
                  setCustomerId("")
                  setErrors((prev) => ({ ...prev, "customer.name": undefined }))
                }}
                placeholder="Who is this bill for"
                aria-invalid={Boolean(errors["customer.name"])}
                className={inputClass}
              />
              <FieldError message={errors["customer.name"]} />
            </label>

            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Phone</FieldLabel>
              <input
                value={customer.phone}
                onChange={(event) =>
                  setCustomer((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="Optional — needed to send on WhatsApp"
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Email</FieldLabel>
              <input
                value={customer.email}
                onChange={(event) => {
                  setCustomer((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                  setErrors((prev) => ({ ...prev, "customer.email": undefined }))
                }}
                placeholder="Optional"
                aria-invalid={Boolean(errors["customer.email"])}
                className={inputClass}
              />
              <FieldError message={errors["customer.email"]} />
            </label>

            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Address</FieldLabel>
              <input
                value={customer.address}
                onChange={(event) =>
                  setCustomer((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
                placeholder="Optional"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Customer PAN</FieldLabel>
              <input
                value={customer.pan}
                onChange={(event) =>
                  setCustomer((prev) => ({ ...prev, pan: event.target.value }))
                }
                placeholder="Optional"
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

        {/* ---- vat, note and totals ---- */}
        <section className="grid gap-3.5 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <FieldLabel>Payment</FieldLabel>
              <PaymentPicker
                value={payment}
                onChange={setPayment}
                chequeNo={chequeNo}
                onChequeNo={setChequeNo}
              />
              <span className="text-n-500 text-[12.5px]">
                Whatever you pick, it can be changed on the bill later — an
                unpaid bill gets marked paid when the money comes in.
              </span>
            </div>

            <ReceivedNow
              payment={payment}
              total={totals.total}
              value={received}
              onChange={(value) => {
                setReceived(value)
                setErrors((prev) =>
                  Object.fromEntries(
                    Object.entries(prev).filter(
                      ([path]) =>
                        !path.startsWith("received") &&
                        path !== "accountId" &&
                        !path.startsWith("allocations")
                    )
                  )
                )
              }}
              errors={errors}
              fallbackAccountId={fallbackAccount}
              today={today}
            />

            <label className="border-n-200 flex items-start gap-2.5 rounded-[10px] border bg-white p-3">
              <input
                type="checkbox"
                checked={withVat}
                onChange={(event) => setWithVat(event.target.checked)}
                className="accent-p-500 mt-0.5 size-4"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">
                  Charge VAT at {quantity(vatRate)}%
                </span>
                <span className="text-n-500 text-[12.5px]">
                  Charged on the total after discounts. The rate is saved on the
                  bill, so changing it later leaves this one alone.
                </span>
              </span>
            </label>

            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Note</FieldLabel>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything that should be printed on the bill"
                className={cn(inputClass, "min-h-[64px] resize-y")}
              />
            </label>
          </div>

          <div className="border-n-200 bg-n-100 flex flex-col gap-2 rounded-[10px] border p-3.5">
            <Total label="Subtotal" value={totals.subtotal} />
            <Total label="Discount" value={-totals.discountTotal} />
            {withVat ? (
              <>
                <Total label="Taxable" value={totals.taxable} />
                <Total
                  label={`VAT ${quantity(vatRate)}%`}
                  value={totals.vatAmount}
                />
              </>
            ) : null}
            <div className="border-n-200 mt-1 border-t pt-2">
              <Total label="Total" value={totals.total} strong />
            </div>
          </div>
        </section>
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
          disabled={create.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : "Raise bill"}
        </button>
      </DialogFooter>

      {/* Nested, so a walk-in can be saved without losing the bill. */}
      <CustomerDialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onCreated={adopt}
      />
    </>
  )
}

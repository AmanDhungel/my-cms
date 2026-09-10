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
import { PaymentPicker } from "@/components/dashboard/sales/payment"
import { Skeleton } from "@/components/ui/skeleton"
import {
  reportMutationError,
  useCreateBill,
  useInventoryItems,
} from "@/lib/queries"
import { money, quantity, totalsOf } from "@/lib/billing"
import { billSchema } from "@/lib/validations/sales"
import type { BillPayment, BillSource } from "@/lib/work-constants"
import type { BillDTO } from "@/models/bill"

type Errors = Partial<Record<string, string>>

type DraftLine = {
  key: string
  itemId?: string
  name: string
  unit: string
  price: string
  qty: string
  /** Only set for inventory lines, to warn before the server refuses. */
  stock?: number
}

/** A discount and the lines it was given to. A line takes only one. */
type Group = { key: string; percent: string; lines: string[] }

let seq = 0
const nextKey = () => `k${++seq}`

export function BillDialog({
  open,
  onClose,
  onCreated,
  vatRate,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
  vatRate: number
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
          <Body onClose={onClose} onCreated={onCreated} vatRate={vatRate} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  onCreated,
  vatRate,
}: {
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
  vatRate: number
}) {
  const [source, setSource] = React.useState<BillSource | null>(null)

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
  onBack,
  onClose,
  onCreated,
}: {
  source: BillSource
  vatRate: number
  onBack: () => void
  onClose: () => void
  onCreated?: (bill: BillDTO) => void
}) {
  const fromInventory = source === "inventory"

  const [customer, setCustomer] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    pan: "",
  })
  const [lines, setLines] = React.useState<DraftLine[]>(
    fromInventory ? [] : [blankLine()]
  )
  const [groups, setGroups] = React.useState<Group[]>([])
  const [withVat, setWithVat] = React.useState(false)
  const [payment, setPayment] = React.useState<BillPayment>("unpaid")
  const [chequeNo, setChequeNo] = React.useState("")
  const [note, setNote] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})

  const stock = useInventoryItems(fromInventory)
  const create = useCreateBill()

  const available = stock.data?.items ?? []

  /** A line's discount is the percentage of whichever group holds it. */
  const percentOf = (key: string) => {
    const group = groups.find((entry) => entry.lines.includes(key))
    return group ? Number(group.percent) || 0 : 0
  }

  const priced = lines.map((line) => ({
    price: Number(line.price) || 0,
    qty: Number(line.qty) || 0,
    discountPct: percentOf(line.key),
  }))

  const totals = totalsOf(priced, withVat ? vatRate : 0)

  function addCustomLine() {
    setLines((prev) => [...prev, blankLine()])
    setErrors((prev) => ({ ...prev, lines: undefined }))
  }

  function addStockLine(itemId: string) {
    const item = available.find((entry) => entry.id === itemId)
    if (!item) return
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        price: String(item.price),
        qty: "1",
        stock: item.stock,
      },
    ])
    setErrors((prev) => ({ ...prev, lines: undefined }))
  }

  function setLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
    setErrors((prev) => ({ ...prev, lines: undefined }))
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key))
    // A discount can't keep pointing at a line that is gone.
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        lines: group.lines.filter((entry) => entry !== key),
      }))
    )
  }

  function toggleInGroup(groupKey: string, lineKey: string) {
    const target = groups.find((group) => group.key === groupKey)
    const adding = !target?.lines.includes(lineKey)

    setGroups((prev) =>
      prev.map((group) => {
        if (group.key === groupKey) {
          return {
            ...group,
            lines: adding
              ? [...group.lines, lineKey]
              : group.lines.filter((entry) => entry !== lineKey),
          }
        }
        // One discount per line: taking it here releases it there.
        return adding
          ? { ...group, lines: group.lines.filter((entry) => entry !== lineKey) }
          : group
      })
    )
  }

  function selectAll(groupKey: string) {
    const all = lines.map((line) => line.key)
    setGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? { ...group, lines: all }
          : { ...group, lines: [] }
      )
    )
  }

  function submit() {
    if (create.isPending) return

    const payload = {
      source,
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
    }

    const parsed = billSchema.safeParse(payload)

    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "root"
        // Every line problem reads as one message above the table.
        next[path.startsWith("lines") ? "lines" : path] ??= issue.message
      }
      setErrors(next)
      return
    }

    create.mutate(parsed.data, {
      onSuccess: ({ bill }) => {
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
          <span className="border-p-200 bg-p-100 text-p-700 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium">
            {fromInventory ? "from inventory" : "custom"}
          </span>
          <button
            type="button"
            onClick={onBack}
            className="text-p-600 text-[12.5px] font-semibold"
          >
            change
          </button>
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
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Customer</FieldLabel>
              <input
                value={customer.name}
                onChange={(event) => {
                  setCustomer((prev) => ({ ...prev, name: event.target.value }))
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

        {/* ---- lines ---- */}
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FieldLabel>Items</FieldLabel>
            {fromInventory ? (
              stock.isPending ? (
                <Skeleton className="h-9 w-52 rounded-md" />
              ) : (
                <select
                  value=""
                  onChange={(event) => {
                    addStockLine(event.target.value)
                    event.target.value = ""
                  }}
                  className={cn(
                    inputClass,
                    "w-full cursor-pointer py-2 text-[13.5px] sm:w-[280px]"
                  )}
                >
                  <option value="">Add an item from stock…</option>
                  {available.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {money(item.price)} / {item.unit} ·{" "}
                      {quantity(item.stock)} left
                    </option>
                  ))}
                </select>
              )
            ) : (
              <button
                type="button"
                onClick={addCustomLine}
                className="text-p-600 text-[12.5px] font-semibold"
              >
                + Add line
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="border-n-300 text-n-500 rounded-md border border-dashed bg-white px-4 py-6 text-center text-[13px]">
              {fromInventory
                ? available.length === 0 && !stock.isPending
                  ? "There is nothing in the inventory yet. Add stock first, or raise a custom bill."
                  : "Nothing on the bill yet. Add an item from stock above."
                : "Nothing on the bill yet."}
            </div>
          ) : (
            <div className="border-n-200 overflow-hidden rounded-[10px] border bg-white">
              <div className="border-n-200 bg-n-100 hidden grid-cols-[1.6fr_90px_110px_100px_110px_36px] gap-2 border-b px-3 py-2 lg:grid">
                {["ITEM", "QTY", "RATE", "DISC", "AMOUNT", ""].map((head) => (
                  <span
                    key={head}
                    className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                  >
                    {head}
                  </span>
                ))}
              </div>

              {lines.map((line, index) => {
                const pct = percentOf(line.key)
                const gross = (Number(line.price) || 0) * (Number(line.qty) || 0)
                const short =
                  line.stock !== undefined && (Number(line.qty) || 0) > line.stock

                return (
                  <div
                    key={line.key}
                    className="border-n-200/70 grid gap-2 border-b px-3 py-2.5 lg:grid-cols-[1.6fr_90px_110px_100px_110px_36px] lg:items-center"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      {line.itemId ? (
                        <>
                          <span className="truncate text-[13.5px] font-semibold">
                            {index + 1}. {line.name}
                          </span>
                          <span
                            className={cn(
                              "text-[11.5px]",
                              short ? "text-s-overdue" : "text-n-500"
                            )}
                          >
                            {short
                              ? `only ${quantity(line.stock ?? 0)} ${line.unit} in stock`
                              : `${quantity(line.stock ?? 0)} ${line.unit} in stock`}
                          </span>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={line.name}
                            onChange={(event) =>
                              setLine(line.key, { name: event.target.value })
                            }
                            placeholder={`Item ${index + 1}`}
                            className={cn(inputClass, "w-full py-2 text-[13.5px]")}
                          />
                          <input
                            value={line.unit}
                            onChange={(event) =>
                              setLine(line.key, { unit: event.target.value })
                            }
                            placeholder="pcs"
                            className={cn(inputClass, "w-[74px] py-2 text-[13.5px]")}
                          />
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(event) =>
                        setLine(line.key, { qty: event.target.value })
                      }
                      aria-label={`Quantity for line ${index + 1}`}
                      className={cn(inputClass, "py-2 text-[13.5px]")}
                    />

                    {line.itemId ? (
                      <span className="text-n-700 font-mono text-[13px] lg:text-right">
                        {money(Number(line.price) || 0)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={line.price}
                        onChange={(event) =>
                          setLine(line.key, { price: event.target.value })
                        }
                        aria-label={`Price per piece for line ${index + 1}`}
                        placeholder="0"
                        className={cn(inputClass, "py-2 text-[13.5px]")}
                      />
                    )}

                    <span
                      className={cn(
                        "font-mono text-[13px] lg:text-right",
                        pct > 0 ? "text-p-700 font-semibold" : "text-n-400"
                      )}
                    >
                      {pct > 0 ? `${quantity(pct)}%` : "—"}
                    </span>

                    <span className="font-mono text-[13px] font-semibold lg:text-right">
                      {money(gross - (gross * pct) / 100)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remove line ${index + 1}`}
                      className="text-n-400 hover:text-s-overdue justify-self-start text-[13px] lg:justify-self-end"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <FieldError message={errors.lines} />
        </section>

        {/* ---- discounts ---- */}
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FieldLabel>Discounts</FieldLabel>
            <button
              type="button"
              onClick={() =>
                setGroups((prev) => [
                  ...prev,
                  { key: nextKey(), percent: "", lines: [] },
                ])
              }
              disabled={lines.length === 0}
              className="text-p-600 text-[12.5px] font-semibold disabled:opacity-50"
            >
              + Add discount
            </button>
          </div>

          <p className="text-n-500 m-0 text-[12.5px]">
            Write a percentage, then tick the lines it applies to. Add a second
            discount for a different set — each line carries one, so ticking it
            here takes it off the other.
          </p>

          {groups.map((group, index) => (
            <div
              key={group.key}
              className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    value={group.percent}
                    onChange={(event) =>
                      setGroups((prev) =>
                        prev.map((entry) =>
                          entry.key === group.key
                            ? { ...entry, percent: event.target.value }
                            : entry
                        )
                      )
                    }
                    aria-label={`Discount ${index + 1} percent`}
                    placeholder="20"
                    className={cn(inputClass, "w-[86px] py-2 text-[13.5px]")}
                  />
                  <span className="text-n-600 text-[13.5px] font-semibold">
                    % off
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => selectAll(group.key)}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGroups((prev) =>
                      prev.map((entry) =>
                        entry.key === group.key ? { ...entry, lines: [] } : entry
                      )
                    )
                  }
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGroups((prev) =>
                      prev.filter((entry) => entry.key !== group.key)
                    )
                  }
                  className="text-n-500 hover:text-s-overdue ml-auto text-[12.5px] font-semibold"
                >
                  Remove
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {lines.map((line, lineIndex) => {
                  const mine = group.lines.includes(line.key)
                  const takenElsewhere =
                    !mine &&
                    groups.some(
                      (entry) =>
                        entry.key !== group.key && entry.lines.includes(line.key)
                    )

                  return (
                    <button
                      key={line.key}
                      type="button"
                      onClick={() => toggleInGroup(group.key, line.key)}
                      aria-pressed={mine}
                      className={cn(
                        "max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                        mine
                          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                          : takenElsewhere
                            ? "border-n-200 text-n-400 bg-n-100 font-medium"
                            : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
                      )}
                    >
                      {lineIndex + 1}. {line.name || "Untitled"}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

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
    </>
  )
}

function Total({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "text-[12.5px]",
          strong ? "font-heading text-[14px] font-semibold" : "text-n-600"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          strong ? "text-[17px] font-semibold" : "text-[13px]"
        )}
      >
        {money(value)}
      </span>
    </div>
  )
}

function blankLine(): DraftLine {
  return { key: nextKey(), name: "", unit: "pcs", price: "", qty: "1" }
}

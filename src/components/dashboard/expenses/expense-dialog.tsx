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
  AccountPicker,
  PartyPicker,
  useDefaultAccountId,
} from "@/components/dashboard/money-pickers"
import { money, quantity } from "@/lib/billing"
import {
  EXPENSE_KIND_GROUPS,
  isPayroll,
  kindLabel,
  linesTotal,
  movesStock,
  payeeLabel,
} from "@/lib/expenses"
import {
  reportMutationError,
  useCreateExpense,
  useInventoryItems,
  usePeople,
  useUpdateExpense,
} from "@/lib/queries"
import { expenseSchema } from "@/lib/validations/expenses"
import type { ExpenseDTO } from "@/models/expense"
import {
  PAYMENT_METHODS,
  type ExpenseKind,
  type PaymentMethod,
} from "@/lib/work-constants"

type Errors = Partial<Record<string, string>>

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank transfer",
  online: "Online",
}

/** A line being typed, where every number is still a string. */
type DraftLine = {
  key: string
  itemId: string
  name: string
  unit: string
  qty: string
  cost: string
  /** What the shelf holds now, shown so a correction can be sanity-checked. */
  stock: number
}

let seq = 0
const nextKey = () => `line-${(seq += 1)}`

export function ExpenseDialog({
  open,
  onClose,
  today,
  kinds,
  initialKind,
  editing,
}: {
  open: boolean
  onClose: () => void
  /** The workspace's today, so the date starts on its calendar not the browser's. */
  today: string
  /** What this viewer may record. A supervisor gets stock purchases only. */
  kinds: readonly ExpenseKind[]
  /** Which kind the form opens on — "stock" from the inventory page. */
  initialKind?: ExpenseKind
  /** Present when correcting one already recorded. */
  editing?: ExpenseDTO | null
}) {
  const correcting = Boolean(editing)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[680px] sm:p-6"
        )}
      >
        {/*
          Mounted only while open, so each entry starts from a clean sheet.
          The header goes inside it too, because what the form is called
          follows the kind being recorded, and that is state in there.
        */}
        {open ? (
          <Body
            onClose={onClose}
            today={today}
            kinds={kinds}
            initialKind={initialKind}
            editing={editing ?? null}
            correcting={correcting}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  today,
  kinds,
  initialKind,
  editing,
  correcting,
}: {
  onClose: () => void
  today: string
  kinds: readonly ExpenseKind[]
  initialKind?: ExpenseKind
  editing: ExpenseDTO | null
  correcting: boolean
}) {
  const [kind, setKind] = React.useState<ExpenseKind>(
    editing?.kind ?? initialKind ?? kinds[0] ?? "other"
  )
  const [payee, setPayee] = React.useState(editing?.payee ?? "")
  const [partyId, setPartyId] = React.useState(editing?.partyId ?? "")
  const [accountId, setAccountId] = React.useState(editing?.accountId ?? "")
  const [employeeId, setEmployeeId] = React.useState(
    editing?.employee?.id ?? ""
  )
  const [amount, setAmount] = React.useState(
    editing && !movesStock(editing.kind) ? String(editing.amount) : ""
  )
  const [method, setMethod] = React.useState<PaymentMethod>(
    editing?.method ?? "cash"
  )
  const [reference, setReference] = React.useState(editing?.reference ?? "")
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [spentOn, setSpentOn] = React.useState(editing?.spentOn ?? today)
  const [lines, setLines] = React.useState<DraftLine[]>(() =>
    (editing?.lines ?? []).map((line) => ({
      key: nextKey(),
      itemId: line.itemId ?? "",
      name: line.name,
      unit: line.unit,
      qty: String(line.qty),
      cost: String(line.cost),
      stock: 0,
    }))
  )
  const [errors, setErrors] = React.useState<Errors>({})

  const buying = movesStock(kind)
  const payroll = isPayroll(kind)

  const stock = useInventoryItems(buying)
  const people = usePeople()
  const create = useCreateExpense()
  const update = useUpdateExpense(editing?.id ?? "")
  const fallbackAccount = useDefaultAccountId()
  const mutation = editing ? update : create

  const available = stock.data?.items ?? []
  const crew = (people.data?.members ?? []).filter(
    (member) => member.status === "active"
  )

  /** Picking a person fills the payee, since that is who was paid. */
  function chooseEmployee(id: string) {
    setEmployeeId(id)
    const member = crew.find((entry) => entry.id === id)
    if (member) setPayee(member.name)
    setErrors((prev) => ({ ...prev, employeeId: undefined, payee: undefined }))
  }

  function addLine(itemId: string) {
    const item = available.find((entry) => entry.id === itemId)
    if (!item) return
    // One line per item: two would make the averaged cost depend on the order
    // they were written in, and the server refuses it anyway.
    if (lines.some((line) => line.itemId === itemId)) {
      toast.info(`${item.name} is already on this purchase`)
      return
    }
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        qty: "1",
        // The last cost on record is the likeliest one to be right again.
        cost: item.costPrice ? String(item.costPrice) : "",
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
  }

  const priced = lines.map((line) => ({
    qty: Number(line.qty) || 0,
    cost: Number(line.cost) || 0,
  }))
  const total = buying ? linesTotal(priced) : Number(amount) || 0

  function submit() {
    if (mutation.isPending) return

    const parsed = expenseSchema.safeParse({
      kind,
      payee,
      partyId: partyId || undefined,
      accountId: accountId || fallbackAccount || undefined,
      employeeId: payroll && employeeId ? employeeId : undefined,
      amount: buying ? undefined : amount || 0,
      method,
      reference: reference || undefined,
      note: note || undefined,
      spentOn,
      lines: buying
        ? lines.map((line) => ({
            itemId: line.itemId,
            qty: line.qty || 0,
            cost: line.cost || 0,
          }))
        : [],
    })

    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        // A line's own complaint is shown against the list, not against a
        // field called "lines.0.qty" that nobody can see.
        const path = issue.path.join(".") || "root"
        next[path.startsWith("lines") ? "lines" : path] ??= issue.message
      }
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: ({ expense }) => {
        toast.success(
          editing
            ? `${money(expense.amount)} to ${expense.payee} corrected`
            : movesStock(expense.kind)
              ? `${money(expense.amount)} of stock in from ${expense.payee}`
              : `${money(expense.amount)} to ${expense.payee} recorded`
        )
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

  // Only the groups this viewer may actually record from.
  const groups = EXPENSE_KIND_GROUPS.map((group) => ({
    label: group.label,
    kinds: group.kinds.filter((one) => kinds.includes(one)),
  })).filter((group) => group.kinds.length > 0)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-[19px] font-semibold">
          {correcting
            ? buying
              ? "Correct this purchase"
              : "Correct this expense"
            : buying
              ? "Record a stock purchase"
              : "Record an expense"}
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          {buying
            ? "What you bought from a vendor, and what it cost. The goods go on the shelf."
            : "Money the business has spent. A stock purchase also puts the goods on the shelf."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>What was it for</FieldLabel>
            <select
              value={kind}
              onChange={(event) => {
                const next = event.target.value as ExpenseKind
                setKind(next)
                // Lines belong to a purchase and to nothing else.
                if (!movesStock(next)) setLines([])
                if (!isPayroll(next)) setEmployeeId("")
                setErrors({})
              }}
              className={cn(inputClass, "cursor-pointer")}
            >
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.kinds.map((one) => (
                    <option key={one} value={one}>
                      {kindLabel(one)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {payroll ? (
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Employee</FieldLabel>
              <select
                value={employeeId}
                onChange={(event) => chooseEmployee(event.target.value)}
                aria-invalid={Boolean(errors.payee)}
                className={cn(inputClass, "cursor-pointer")}
              >
                <option value="">Pick a person</option>
                {crew.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.payee ?? errors.employeeId} />
            </label>
          ) : (
            <PartyPicker
              label={payeeLabel(kind)}
              side="vendor"
              name={payee}
              partyId={partyId}
              onName={(value) => {
                setPayee(value)
                setErrors((prev) => ({ ...prev, payee: undefined }))
              }}
              onParty={setPartyId}
              error={errors.payee}
              placeholder={buying ? "Who you bought from" : "Company or person"}
            />
          )}
        </div>

        {buying ? (
          <Purchase
            lines={lines}
            available={available}
            loading={stock.isPending}
            total={total}
            error={errors.lines}
            onAdd={addLine}
            onSet={setLine}
            onRemove={removeLine}
          />
        ) : null}

        {/* A purchase has no amount field: the lines above already total it,
            and a second copy of the same figure only invites the two to
            disagree. */}
        <div
          className={cn(
            "grid gap-3.5",
            buying ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          {buying ? null : (
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Amount</FieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setErrors((prev) => ({ ...prev, amount: undefined }))
                }}
                placeholder="0"
                aria-invalid={Boolean(errors.amount)}
                className={inputClass}
              />
              <FieldError message={errors.amount} />
            </label>
          )}

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              value={spentOn}
              onChange={(event) => {
                setSpentOn(event.target.value)
                setErrors((prev) => ({ ...prev, spentOn: undefined }))
              }}
              aria-invalid={Boolean(errors.spentOn)}
              className={inputClass}
            />
            <FieldError message={errors.spentOn} />
          </label>

          <AccountPicker
            value={accountId}
            onChange={setAccountId}
            error={errors.accountId}
          />

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Method</FieldLabel>
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
              className={cn(inputClass, "cursor-pointer")}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {METHOD_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>
              {method === "cheque"
                ? "Cheque no."
                : buying
                  ? "Vendor's bill no."
                  : "Reference"}
            </FieldLabel>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(errors.reference)}
              className={inputClass}
            />
            <FieldError message={errors.reference} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Note</FieldLabel>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(errors.note)}
              className={inputClass}
            />
            <FieldError message={errors.note} />
          </label>
        </div>

        <p className="text-n-500 m-0 text-[12px] leading-relaxed">
          {buying
            ? "Recording this puts the quantities on the shelf and updates what each item is reckoned to have cost. It also shows on the Payments page as money out."
            : "This also shows on the Payments page as money out, so the cash ledger stays complete."}
        </p>
      </div>

      <DialogFooter className="mt-1 gap-2 sm:gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending
            ? "Saving…"
            : editing
              ? "Save changes"
              : buying
                ? "Record purchase"
                : "Record expense"}
        </button>
      </DialogFooter>
    </>
  )
}

/** The item lines of a stock purchase, and what they add up to. */
function Purchase({
  lines,
  available,
  loading,
  total,
  error,
  onAdd,
  onSet,
  onRemove,
}: {
  lines: DraftLine[]
  available: { id: string; name: string; unit: string; stock: number }[]
  loading: boolean
  total: number
  error?: string
  onAdd: (itemId: string) => void
  onSet: (key: string, patch: Partial<DraftLine>) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3">
      <div className="flex flex-col gap-[7px]">
        <FieldLabel>Items bought</FieldLabel>
        <select
          value=""
          disabled={loading}
          onChange={(event) => {
            if (event.target.value) onAdd(event.target.value)
          }}
          aria-label="Add an item to the purchase"
          className={cn(inputClass, "cursor-pointer py-2 text-[13.5px]")}
        >
          <option value="">
            {loading ? "Loading the stock list…" : "Add an item…"}
          </option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {quantity(item.stock)} {item.unit} on the shelf
            </option>
          ))}
        </select>
      </div>

      {lines.length === 0 ? (
        <p className="text-n-500 m-0 px-0.5 py-2 text-[12.5px]">
          Nothing on this purchase yet. Pick the items you bought, then say how
          many and what each one cost.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lines.map((line) => {
            const qty = Number(line.qty) || 0
            const cost = Number(line.cost) || 0

            return (
              <div
                key={line.key}
                className="border-n-200/70 grid items-end gap-2 border-b pb-2 last:border-0 last:pb-0 sm:grid-cols-[1fr_90px_110px_100px_34px]"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-semibold">
                    {line.name}
                  </span>
                  <span className="text-n-500 text-[11.5px]">
                    per {line.unit}
                  </span>
                </span>

                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    QTY
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    value={line.qty}
                    onChange={(event) =>
                      onSet(line.key, { qty: event.target.value })
                    }
                    className={cn(inputClass, "h-[36px] py-1 text-[13px]")}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                    COST EACH
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={line.cost}
                    onChange={(event) =>
                      onSet(line.key, { cost: event.target.value })
                    }
                    placeholder="0"
                    className={cn(inputClass, "h-[36px] py-1 text-[13px]")}
                  />
                </label>

                <span className="font-mono text-[13px] font-semibold tabular-nums sm:text-right">
                  {money(Math.round(qty * cost * 100) / 100)}
                </span>

                <button
                  type="button"
                  onClick={() => onRemove(line.key)}
                  aria-label={`Remove ${line.name}`}
                  className="text-n-400 hover:bg-n-100 hover:text-s-overdue h-[36px] rounded-md px-2 text-[16px] leading-none"
                >
                  ×
                </button>
              </div>
            )
          })}

          <div className="border-n-200 flex items-center justify-between border-t pt-2">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
              PURCHASE TOTAL
            </span>
            <span className="font-mono text-[14px] font-semibold tabular-nums">
              {money(total)}
            </span>
          </div>
        </div>
      )}

      <FieldError message={error} />
    </div>
  )
}

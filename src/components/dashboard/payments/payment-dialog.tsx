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
  AccountAllocationField,
  allocationPayload,
  draftFrom,
  emptyAllocationDraft,
  previousOf,
  validateAllocation,
  type AllocationDraft,
} from "@/components/dashboard/account-allocation-field"
import {
  PartyPicker,
  rememberAccount,
  useAccountFor,
  useCanSeeAccounts,
} from "@/components/dashboard/money-pickers"
import { money } from "@/lib/billing"
import {
  reportMutationError,
  useBills,
  useExpenses,
  useCreatePayment,
  useUpdatePayment,
} from "@/lib/queries"
import type { PaymentDTO } from "@/models/payment"
import { paymentSchema } from "@/lib/validations/payments"
import {
  PAYMENT_METHODS,
  type PaymentDirection,
  type PaymentMethod,
} from "@/lib/work-constants"

type Errors = Partial<Record<string, string>>

/** Starting values for a new payment (PaymentDialog's `initial`). */
export type PaymentPrefill = {
  direction: PaymentDirection
  party: string
  partyId: string
  amount?: number
  billId?: string
  purchaseId?: string
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank transfer",
  online: "Online",
}

export function PaymentDialog({
  open,
  onClose,
  today,
  editing = null,
  initial,
}: {
  open: boolean
  onClose: () => void
  /** The workspace's today, so the date starts on its calendar not the browser's. */
  today: string
  /** A payment to correct; absent to record a new one. */
  editing?: PaymentDTO | null
  /**
   * A new payment's starting values, e.g. from a party's Ledger tab: who,
   * which way, and the oldest bill or purchase still open.
   */
  initial?: PaymentPrefill
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
            {editing ? "Edit payment" : "Record a payment"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Money that has actually changed hands, either way.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each entry starts from a clean sheet. */}
        {open ? (
          <Body
            onClose={onClose}
            today={today}
            editing={editing}
            initial={initial}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  today,
  editing,
  initial,
}: {
  onClose: () => void
  today: string
  editing: PaymentDTO | null
  initial?: PaymentPrefill
}) {
  const [direction, setDirection] = React.useState<PaymentDirection>(
    editing?.direction ?? initial?.direction ?? "in"
  )
  const [party, setParty] = React.useState(editing?.party ?? initial?.party ?? "")
  const [partyId, setPartyId] = React.useState(
    editing?.partyId ?? initial?.partyId ?? ""
  )
  const [allocation, setAllocation] = React.useState<AllocationDraft>(() =>
    editing ? draftFrom(editing) : emptyAllocationDraft
  )
  const [amount, setAmount] = React.useState(
    editing ? String(editing.amount) : initial?.amount ? String(initial.amount) : ""
  )
  const [method, setMethod] = React.useState<PaymentMethod>(
    editing?.method ?? "cash"
  )
  const [reference, setReference] = React.useState(editing?.reference ?? "")
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [paidOn, setPaidOn] = React.useState(editing?.paidOn ?? today)
  const [billId, setBillId] = React.useState(
    editing?.bill?.id ?? initial?.billId ?? ""
  )
  // Money out can pay off a purchase made on credit.
  const [purchaseId, setPurchaseId] = React.useState(
    editing?.purchaseId ?? initial?.purchaseId ?? ""
  )
  const [errors, setErrors] = React.useState<Errors>({})

  const bills = useBills()
  const expenses = useExpenses()
  const create = useCreatePayment()
  const update = useUpdatePayment(editing?.id ?? "")
  const mutation = editing ? update : create
  // The account last used with this method, else the default one.
  const fallbackAccount = useAccountFor(method)
  const canSeeAccounts = useCanSeeAccounts()
  // On an edit, the low-balance check puts this payment's own money back first.
  const previous = React.useMemo(
    () => (editing ? previousOf(editing, editing.direction) : null),
    [editing]
  )

  // Anything still owed on, whether nothing has been paid yet or half has —
  // and, on an edit, the bill this one is already against.
  const settleable = (bills.data?.bills ?? []).filter(
    (bill) =>
      (bill.status === "issued" && bill.due > 0) || bill.id === editing?.bill?.id
  )

  const chosen = settleable.find((bill) => bill.id === billId)

  // Purchases with something still owed on them — the chosen party's first,
  // and only theirs once one is picked.
  const payable = (expenses.data?.expenses ?? []).filter(
    (one) =>
      ((one.due ?? 0) > 0 || one.id === editing?.purchaseId) &&
      (!partyId || one.partyId === partyId)
  )
  const chosenPurchase = payable.find((one) => one.id === purchaseId)

  /** Picking a purchase offers what is owed on it, and its supplier. */
  function choosePurchase(id: string) {
    setPurchaseId(id)
    setErrors((prev) => ({ ...prev, purchaseId: undefined }))
    const purchase = payable.find((one) => one.id === id)
    if (!purchase) return
    if (!amount) setAmount(String(purchase.due ?? ""))
    if (purchase.partyId && !partyId) {
      setPartyId(purchase.partyId)
      setParty(purchase.payee)
    }
  }

  /** Picking a bill offers its balance, which is the usual amount to enter. */
  function chooseBill(id: string) {
    setBillId(id)
    setErrors((prev) => ({ ...prev, billId: undefined }))
    const bill = settleable.find((entry) => entry.id === id)
    if (bill && !amount) setAmount(String(bill.due))
  }

  function submit() {
    if (mutation.isPending) return

    const parsed = paymentSchema.safeParse({
      direction,
      party,
      partyId: partyId || undefined,
      // Nothing for cash; one account, or a split, for anything else.
      ...allocationPayload(allocation, method, fallbackAccount),
      amount: amount || 0,
      method,
      reference: reference || undefined,
      note: note || undefined,
      paidOn,
      billId: direction === "in" && billId ? billId : undefined,
      purchaseId: direction === "out" && purchaseId ? purchaseId : undefined,
    })

    const next: Errors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
    }
    // The same account rules the server applies, so the message lands here
    // rather than in a toast.
    Object.assign(
      next,
      validateAllocation(allocation, {
        method,
        amount: Number(amount) || 0,
        fallbackAccountId: fallbackAccount,
        requireAccount: canSeeAccounts,
      })
    )
    if (!parsed.success || Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: ({ payment }) => {
        rememberAccount(payment.method, payment.accountId ?? payment.allocations?.[0]?.accountId)
        toast.success(
          editing
            ? "Payment updated"
            : payment.direction === "in"
              ? `${money(payment.amount)} in from ${payment.party}`
              : `${money(payment.amount)} out to ${payment.party}`
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
        <div className="grid gap-2.5 sm:grid-cols-2">
          <DirectionCard
            title="Money in"
            blurb="Someone paid you."
            active={direction === "in"}
            onPick={() => setDirection("in")}
          />
          <DirectionCard
            title="Money out"
            blurb="You paid a company or a person."
            active={direction === "out"}
            onPick={() => {
              setDirection("out")
              setBillId("")
              setPurchaseId("")
            }}
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <PartyPicker
            label={direction === "in" ? "Paid by" : "Paid to"}
            side={direction === "in" ? "customer" : "vendor"}
            name={party}
            partyId={partyId}
            onName={(value) => {
              setParty(value)
              setErrors((prev) => ({ ...prev, party: undefined }))
            }}
            onParty={setPartyId}
            error={errors.party}
            autoFocus={!editing}
          />

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
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              value={paidOn}
              onChange={(event) => {
                setPaidOn(event.target.value)
                setErrors((prev) => ({ ...prev, paidOn: undefined }))
              }}
              aria-invalid={Boolean(errors.paidOn)}
              className={inputClass}
            />
            <FieldError message={errors.paidOn} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Method</FieldLabel>
            <select
              value={method}
              onChange={(event) => {
                const next = event.target.value as PaymentMethod
                setMethod(next)
                // Cash moves through no account: whatever was picked goes.
                if (next === "cash") setAllocation(emptyAllocationDraft)
                setErrors((prev) => ({
                  ...prev,
                  accountId: undefined,
                  allocations: undefined,
                }))
              }}
              className={cn(inputClass, "cursor-pointer")}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {METHOD_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>
              {method === "cheque" ? "Cheque no." : "Reference"}
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
        </div>

        <AccountAllocationField
          method={method}
          amount={Number(amount) || 0}
          direction={direction}
          value={allocation}
          onChange={(next) => {
            setAllocation(next)
            setErrors((prev) =>
              Object.fromEntries(
                Object.entries(prev).filter(
                  ([path]) =>
                    path !== "accountId" && !path.startsWith("allocations")
                )
              )
            )
          }}
          errors={errors}
          previous={previous}
          fallbackAccountId={fallbackAccount}
        />

        {direction === "in" ? (
          <div className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3">
            <div className="flex flex-col gap-[7px]">
              <FieldLabel>Against a bill</FieldLabel>
              <select
                value={billId}
                onChange={(event) => chooseBill(event.target.value)}
                aria-label="Against a bill"
                className={cn(inputClass, "cursor-pointer py-2 text-[13.5px]")}
              >
                <option value="">Not against a bill</option>
                {settleable.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.number} · {bill.customer.name} · {money(bill.due)} due
                  </option>
                ))}
              </select>
              <FieldError message={errors.billId} />
            </div>

            {chosen ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">
                  {money(chosen.due)} still due on {chosen.number}
                  {chosen.paid > 0
                    ? ` · ${money(chosen.paid)} of ${money(chosen.total)} paid so far`
                    : ""}
                </span>
                <span className="text-n-500 text-[12.5px]">
                  {/* Part payments are the point: the balance is what carries. */}
                  {(Number(amount) || 0) >= chosen.due
                    ? "This settles it."
                    : `Leaves ${money(Math.max(0, chosen.due - (Number(amount) || 0)))} outstanding.`}
                </span>
              </div>
            ) : (
              <span className="text-n-500 text-[12.5px]">
                Only bills with money still owed on them are listed.
              </span>
            )}
          </div>
        ) : payable.length > 0 || purchaseId ? (
          <div className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3">
            <div className="flex flex-col gap-[7px]">
              <FieldLabel>Against a purchase</FieldLabel>
              <select
                value={purchaseId}
                onChange={(event) => choosePurchase(event.target.value)}
                aria-label="Against a purchase"
                className={cn(inputClass, "cursor-pointer py-2 text-[13.5px]")}
              >
                <option value="">Not against a purchase</option>
                {payable.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.spentOn} · {one.payee} · {money(one.due ?? 0)} to pay
                  </option>
                ))}
              </select>
              <FieldError message={errors.purchaseId} />
            </div>
            <span className="text-n-500 text-[12.5px]">
              {chosenPurchase
                ? (Number(amount) || 0) >= (chosenPurchase.due ?? 0)
                  ? "This pays it off."
                  : `Leaves ${money(Math.max(0, (chosenPurchase.due ?? 0) - (Number(amount) || 0)))} to pay.`
                : "Purchases bought on credit, with something still to pay."}
            </span>
          </div>
        ) : null}

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>What it was for</FieldLabel>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — rent, materials, wages, part payment…"
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
            : editing
              ? "Save changes"
              : "Record payment"}
        </button>
      </DialogFooter>
    </>
  )
}

function DirectionCard({
  title,
  blurb,
  active,
  onPick,
}: {
  title: string
  blurb: string
  active: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-p-400 bg-p-100"
          : "border-n-300 hover:bg-n-100 bg-white"
      )}
    >
      <span
        className={cn(
          "font-heading text-[14.5px] font-semibold",
          active && "text-p-700"
        )}
      >
        {title}
      </span>
      <span className="text-n-600 text-[12.5px]">{blurb}</span>
    </button>
  )
}

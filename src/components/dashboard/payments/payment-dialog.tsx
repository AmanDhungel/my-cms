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
import { money } from "@/lib/billing"
import { reportMutationError, useBills, useCreatePayment } from "@/lib/queries"
import { paymentSchema } from "@/lib/validations/payments"
import {
  PAYMENT_METHODS,
  type PaymentDirection,
  type PaymentMethod,
} from "@/lib/work-constants"

type Errors = Partial<Record<string, string>>

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
  parties,
}: {
  open: boolean
  onClose: () => void
  /** The workspace's today, so the date starts on its calendar not the browser's. */
  today: string
  /** Names already used, offered as you type. */
  parties: string[]
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
            Record a payment
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Money that has actually changed hands, either way.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each entry starts from a clean sheet. */}
        {open ? (
          <Body onClose={onClose} today={today} parties={parties} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  onClose,
  today,
  parties,
}: {
  onClose: () => void
  today: string
  parties: string[]
}) {
  const [direction, setDirection] = React.useState<PaymentDirection>("in")
  const [party, setParty] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  const [reference, setReference] = React.useState("")
  const [note, setNote] = React.useState("")
  const [paidOn, setPaidOn] = React.useState(today)
  const [billId, setBillId] = React.useState("")
  const [settleBill, setSettleBill] = React.useState(true)
  const [errors, setErrors] = React.useState<Errors>({})

  const bills = useBills()
  const create = useCreatePayment()

  // Only a live bill with money still owed on it can be settled by a payment.
  const settleable = (bills.data?.bills ?? []).filter(
    (bill) =>
      bill.status === "issued" &&
      (bill.payment === "unpaid" || bill.payment === "cheque")
  )

  const chosen = settleable.find((bill) => bill.id === billId)

  function submit() {
    if (create.isPending) return

    const parsed = paymentSchema.safeParse({
      direction,
      party,
      amount: amount || 0,
      method,
      reference: reference || undefined,
      note: note || undefined,
      paidOn,
      billId: direction === "in" && billId ? billId : undefined,
      settleBill: direction === "in" && billId ? settleBill : undefined,
    })

    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    create.mutate(parsed.data, {
      onSuccess: ({ payment }) => {
        toast.success(
          payment.direction === "in"
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
            }}
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>{direction === "in" ? "Paid by" : "Paid to"}</FieldLabel>
            <input
              value={party}
              onChange={(event) => {
                setParty(event.target.value)
                setErrors((prev) => ({ ...prev, party: undefined }))
              }}
              list="ems-parties"
              placeholder="Company or person"
              aria-invalid={Boolean(errors.party)}
              className={inputClass}
            />
            {/* Names already in the ledger, so the same one isn't spelled two ways. */}
            <datalist id="ems-parties">
              {parties.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <FieldError message={errors.party} />
          </label>

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

        {direction === "in" ? (
          <div className="border-n-200 flex flex-col gap-2.5 rounded-[10px] border bg-white p-3">
            <div className="flex flex-col gap-[7px]">
              <FieldLabel>Against a bill</FieldLabel>
              <select
                value={billId}
                onChange={(event) => {
                  setBillId(event.target.value)
                  setErrors((prev) => ({ ...prev, billId: undefined }))
                }}
                aria-label="Against a bill"
                className={cn(inputClass, "cursor-pointer py-2 text-[13.5px]")}
              >
                <option value="">Not against a bill</option>
                {settleable.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.number} · {bill.customer.name} · {money(bill.total)}
                  </option>
                ))}
              </select>
              <FieldError message={errors.billId} />
            </div>

            {chosen ? (
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={settleBill}
                  onChange={(event) => setSettleBill(event.target.checked)}
                  className="accent-p-500 mt-0.5 size-4"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">
                    Mark {chosen.number} paid
                  </span>
                  <span className="text-n-500 text-[12.5px]">
                    {money(chosen.total)} owed. Leave this off if the payment
                    only covers part of it.
                  </span>
                </span>
              </label>
            ) : (
              <span className="text-n-500 text-[12.5px]">
                Only unpaid bills and bills on cheque are listed.
              </span>
            )}
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
          disabled={create.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : "Record payment"}
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

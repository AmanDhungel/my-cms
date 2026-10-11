"use client"

import { cn } from "cn"

import {
  AccountAllocationField,
  allocationPayload,
  emptyAllocationDraft,
  validateAllocation,
  type AllocationDraft,
} from "@/components/dashboard/account-allocation-field"
import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { money } from "@/lib/billing"
import { fromPaisa, toPaisa } from "@/lib/allocations"
import {
  PAYMENT_METHODS,
  type BillPayment,
  type PaymentMethod,
} from "@/lib/work-constants"

/**
 * Money taken at the till as a bill is raised.
 *
 * "Paid" takes the whole total now; "Unpaid" can still take part of it, with
 * the rest left owing until a due date; "Cheque" records the cheque as the
 * money in. Whatever is taken is saved as an ordinary "Money in" payment
 * against the bill, through the same account rules as every other payment —
 * cash moves through no account, anything else through one.
 */

export type ReceivedDraft = {
  /** Only read for an unpaid bill; "Paid" and "Cheque" take the total. */
  amount: string
  method: PaymentMethod
  allocation: AllocationDraft
  /** "YYYY-MM-DD"; empty means due the day it is raised. */
  dueDate: string
}

export const emptyReceived: ReceivedDraft = {
  amount: "",
  method: "cash",
  allocation: emptyAllocationDraft,
  dueDate: "",
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank transfer",
  online: "Online / QR",
}

/** What is being taken now, in paisa, for the flag picked. */
export function receivedPaisa(payment: BillPayment, total: number, draft: ReceivedDraft) {
  if (payment === "quotation") return 0
  if (payment === "paid" || payment === "cheque") return toPaisa(total)
  return Math.max(0, toPaisa(Number(draft.amount) || 0))
}

function methodFor(payment: BillPayment, draft: ReceivedDraft): PaymentMethod {
  return payment === "cheque" ? "cheque" : draft.method
}

/** The request fields: `received` when anything is taken, and the due date. */
export function receivedPayload(
  payment: BillPayment,
  total: number,
  draft: ReceivedDraft,
  fallbackAccountId: string
) {
  const paisa = receivedPaisa(payment, total, draft)
  const method = methodFor(payment, draft)
  return {
    ...(paisa > 0
      ? {
          received: {
            amount: fromPaisa(paisa),
            method,
            ...allocationPayload(draft.allocation, method, fallbackAccountId),
          },
        }
      : {}),
    ...(payment === "unpaid" && draft.dueDate ? { dueDate: draft.dueDate } : {}),
  }
}

/** The checks the server makes, so the message lands on the field. */
export function validateReceived(
  payment: BillPayment,
  total: number,
  draft: ReceivedDraft,
  options: { fallbackAccountId: string; requireAccount: boolean }
): Record<string, string> {
  const paisa = receivedPaisa(payment, total, draft)
  if (paisa > toPaisa(total)) {
    return { "received.amount": "That is more than the bill comes to" }
  }
  if (paisa === 0) return {}
  return validateAllocation(draft.allocation, {
    method: methodFor(payment, draft),
    amount: fromPaisa(paisa),
    fallbackAccountId: options.fallbackAccountId,
    requireAccount: options.requireAccount,
  })
}

export function ReceivedNow({
  payment,
  total,
  value,
  onChange,
  errors,
  fallbackAccountId,
  today,
}: {
  payment: BillPayment
  total: number
  value: ReceivedDraft
  onChange: (next: ReceivedDraft) => void
  errors: Partial<Record<string, string>>
  fallbackAccountId: string
  today: string
}) {
  if (payment === "quotation") return null

  const paisa = receivedPaisa(payment, total, value)
  const method = methodFor(payment, value)
  const owing = Math.max(0, toPaisa(total) - paisa)

  return (
    <div className="border-n-200 flex flex-col gap-3 rounded-[10px] border bg-white p-3">
      {payment === "unpaid" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Received now</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: event.target.value })}
              placeholder="0 — nothing yet"
              aria-invalid={Boolean(errors["received.amount"])}
              className={cn(inputClass, "py-2 text-[14px]")}
            />
            <FieldError message={errors["received.amount"]} />
          </label>
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Due by</FieldLabel>
            <input
              type="date"
              min={today}
              value={value.dueDate}
              onChange={(event) => onChange({ ...value, dueDate: event.target.value })}
              className={cn(inputClass, "py-2 text-[14px]")}
            />
            <span className="text-n-500 text-[11.5px]">
              Leave empty if it is due today.
            </span>
          </label>
        </div>
      ) : (
        <span className="text-[13.5px] font-semibold">
          {payment === "cheque"
            ? `A cheque for ${money(total)} — recorded as money in.`
            : `Received in full: ${money(total)}`}
        </span>
      )}

      {paisa > 0 ? (
        <>
          {payment === "cheque" ? null : (
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>How it was paid</FieldLabel>
              <select
                value={method}
                onChange={(event) => {
                  const next = event.target.value as PaymentMethod
                  onChange({
                    ...value,
                    method: next,
                    // Cash moves through no account.
                    allocation: next === "cash" ? emptyAllocationDraft : value.allocation,
                  })
                }}
                className={cn(inputClass, "cursor-pointer py-2 text-[14px]")}
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option} value={option}>
                    {METHOD_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <AccountAllocationField
            method={method}
            amount={paisa / 100}
            direction="in"
            value={value.allocation}
            onChange={(allocation) => onChange({ ...value, allocation })}
            errors={errors}
            fallbackAccountId={fallbackAccountId}
          />
        </>
      ) : null}

      {payment === "unpaid" ? (
        <span className="text-n-600 text-[12.5px]">
          {paisa > 0
            ? `${money(owing / 100)} left owing on this bill.`
            : "The whole bill is left owing — it shows under To collect."}
        </span>
      ) : null}
    </div>
  )
}

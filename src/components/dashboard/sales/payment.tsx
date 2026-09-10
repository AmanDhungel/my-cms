"use client"

import { cn } from "cn"

import { BILL_PAYMENTS, type BillPayment } from "@/lib/work-constants"

export const PAYMENT_LABELS: Record<BillPayment, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  cheque: "Cheque",
  quotation: "Quotation",
}

/**
 * Green for settled, red for owing, marigold for a cheque still to clear,
 * and a quiet blue for a quotation — it is not money either way yet.
 */
const PAYMENT_TONE: Record<BillPayment, string> = {
  paid: "border-s-done/40 text-s-done bg-[#eefaf4]",
  unpaid: "border-s-overdue/40 text-s-overdue bg-[#fdecec]",
  cheque: "border-a-400 text-a-700 bg-a-50",
  quotation: "border-s-progress/40 text-s-progress bg-[#eef4fd]",
}

export function PaymentChip({
  payment,
  chequeNo,
  className,
}: {
  payment: BillPayment
  chequeNo?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-[0.05em] uppercase",
        PAYMENT_TONE[payment],
        className
      )}
    >
      {PAYMENT_LABELS[payment]}
      {payment === "cheque" && chequeNo ? ` ${chequeNo}` : ""}
    </span>
  )
}

/**
 * The three-way switch, used both while a bill is being written and after it
 * is raised. Presentational: the caller decides whether a change is local
 * state or a request.
 */
export function PaymentPicker({
  value,
  onChange,
  chequeNo,
  onChequeNo,
  disabled,
}: {
  value: BillPayment
  onChange: (next: BillPayment) => void
  chequeNo: string
  onChequeNo: (next: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="border-n-200 flex gap-0.5 rounded-md border bg-white p-0.5">
        {BILL_PAYMENTS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            disabled={disabled}
            aria-pressed={value === option}
            className={cn(
              "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-60",
              value === option
                ? "bg-p-100 text-p-700 font-semibold"
                : "text-n-600 hover:bg-n-100 font-medium"
            )}
          >
            {PAYMENT_LABELS[option]}
          </button>
        ))}
      </div>

      {value === "cheque" ? (
        <input
          value={chequeNo}
          onChange={(event) => onChequeNo(event.target.value)}
          disabled={disabled}
          aria-label="Cheque number"
          placeholder="Cheque no. (optional)"
          className="border-n-300 focus:border-p-500 text-n-900 placeholder:text-n-400 w-[190px] rounded-md border bg-white px-3 py-2 text-[13px] outline-none"
        />
      ) : null}
    </div>
  )
}

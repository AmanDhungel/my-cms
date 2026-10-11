import Link from "next/link"
import { cn } from "cn"

import { money } from "@/lib/billing"

/**
 * The dashboard's money glance, when Sales & stock is on: what is to be
 * collected and paid (the same party balances as the Parties list and the
 * Ledger tab — owner only, like every money page) and the open estimates.
 * Each one opens its list.
 */
export function MoneyWidgets({
  toCollect,
  toPay,
  openEstimates,
}: {
  /** null: this viewer doesn't see party balances. */
  toCollect: number | null
  toPay: number | null
  openEstimates: { count: number; total: number }
}) {
  return (
    <div className={cn("grid gap-3.5", toCollect === null ? "sm:grid-cols-1 xl:max-w-sm" : "sm:grid-cols-3")}>
      {toCollect !== null ? (
        <Widget
          href="/dashboard/customers"
          label="TO COLLECT"
          value={`Rs ${money(toCollect)}`}
          hint="They owe you"
          tone="text-s-done"
        />
      ) : null}
      {toPay !== null ? (
        <Widget
          href="/dashboard/customers"
          label="TO PAY"
          value={`Rs ${money(toPay)}`}
          hint="You owe them"
          tone="text-s-overdue"
        />
      ) : null}
      <Widget
        href="/dashboard/sales?tab=estimates"
        label="OPEN ESTIMATES"
        value={String(openEstimates.count)}
        hint={`worth Rs ${money(openEstimates.total)}`}
        tone="text-n-900"
      />
    </div>
  )
}

function Widget({
  href,
  label,
  value,
  hint,
  tone,
}: {
  href: string
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <Link
      href={href}
      className="border-n-200 hover:border-p-400 flex flex-col gap-2 rounded-xl border bg-white p-4 transition-colors"
    >
      <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">{label}</span>
      <span className={cn("font-heading text-[24px] leading-none font-semibold", tone)}>{value}</span>
      <span className="text-n-600 text-[12.5px]">{hint}</span>
    </Link>
  )
}

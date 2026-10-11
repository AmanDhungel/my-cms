import { cn } from "cn"

import { money } from "@/lib/billing"

/**
 * A party's balance in plain words (lib/khata.ts): green "They owe you",
 * red "You owe them", grey "Settled". Never debit or credit.
 */
export function balanceWords(balance: number) {
  if (balance > 0) return `They owe you Rs ${money(balance)}`
  if (balance < 0) return `You owe them Rs ${money(-balance)}`
  return "Settled"
}

export function BalancePill({
  balance,
  size = "sm",
  className,
}: {
  balance: number
  size?: "sm" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border font-semibold whitespace-nowrap tabular-nums",
        className,
        size === "lg" ? "px-4 py-2 text-[17px]" : "px-2.5 py-0.5 text-[12.5px]",
        balance > 0
          ? "border-s-done/40 text-s-done bg-[#eefaf4]"
          : balance < 0
            ? "border-s-overdue/40 text-s-overdue bg-[#fdecec]"
            : "border-n-300 text-n-600 bg-n-100"
      )}
    >
      {balanceWords(balance)}
    </span>
  )
}

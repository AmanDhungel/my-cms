import { cn } from "cn"

import { ESTIMATE_LABELS, type EstimateState } from "@/lib/estimates"

/**
 * Grey draft, blue sent, green accepted, red declined or expired, petrol
 * (the brand's teal) once it has become a sale — the existing status palette.
 */
const TONE: Record<EstimateState, string> = {
  draft: "border-n-300 text-n-600 bg-n-100",
  sent: "border-s-progress/40 text-s-progress bg-[#eef4fd]",
  accepted: "border-s-done/40 text-s-done bg-[#eefaf4]",
  declined: "border-s-overdue/40 text-s-overdue bg-[#fdecec]",
  expired: "border-s-overdue/40 text-s-overdue bg-[#fdecec]",
  converted: "border-p-400 text-p-700 bg-p-100",
}

export function EstimateChip({ state, className }: { state: EstimateState; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-[0.05em] whitespace-nowrap uppercase",
        TONE[state],
        className
      )}
    >
      {ESTIMATE_LABELS[state]}
    </span>
  )
}

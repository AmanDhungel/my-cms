import Link from "next/link"
import { cn } from "cn"

/**
 * The party page's two views: Overview (the page as it always was) and
 * Ledger (the plain-language statement, components/.../khata-view.tsx).
 * The same tab strip the Sales and Payments pages use.
 */
export function PartyTabs({ id, tab }: { id: string; tab: "overview" | "ledger" }) {
  return (
    <div data-no-print className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
      {(
        [
          ["overview", "Overview", `/dashboard/customers/${id}`],
          ["ledger", "Ledger", `/dashboard/customers/${id}?tab=ledger`],
        ] as const
      ).map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={tab === key ? "page" : undefined}
          className={cn(
            "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors",
            tab === key
              ? "bg-p-100 text-p-700 font-semibold"
              : "text-n-600 hover:bg-n-100 font-medium"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}

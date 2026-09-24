"use client"

import { ExpensesPanel } from "@/components/dashboard/expenses/expenses-panel"
import { DashboardMain, PageHeading } from "@/components/dashboard/ui"
import { EXPENSE_KINDS } from "@/lib/expenses"

/**
 * The ledger on its own page.
 *
 * The same panel the Sales page shows under its Expenses tab — one list, one
 * set of rules, reachable from wherever you happened to be. What it gains
 * here is room: no bills competing for the width, and every kind in view
 * rather than only the stock half the Inventory page cares about.
 */
export function ExpensesView({ today }: { today: string }) {
  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Sales & stock"
        title="Expenses"
        subtitle="Everything the business pays for — salaries, rent, fuel, a vendor's bill. Buying stock also puts the goods on the shelf."
      />

      <ExpensesPanel today={today} kinds={EXPENSE_KINDS} />
    </DashboardMain>
  )
}

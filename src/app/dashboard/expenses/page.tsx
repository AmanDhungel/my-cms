import type { Metadata } from "next"

import { ExpensesView } from "@/components/dashboard/expenses/expenses-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Expenses · EMS" }

/**
 * The whole ledger on a page of its own.
 *
 * Owner only, the same rule the Payments page beside it keeps: a supervisor
 * runs the stock and the bills, and records the stock purchases from the
 * Inventory page, but doesn't see what the business pays out.
 */
export default async function ExpensesPage() {
  const viewer = await requirePageRole("owner")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  // Dates start on the workspace's calendar, not the browser's.
  return <ExpensesView today={dayKeyInZone(new Date(), business.timeZone)} />
}

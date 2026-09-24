import type { Metadata } from "next"

import { SalesView } from "@/components/dashboard/sales/sales-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Sales · EMS" }

export default async function SalesPage() {
  // Owners and supervisors only, the same as Inventory beside it.
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  return (
    <SalesView
      // The dialog needs the saved rate to label its VAT switch.
      vatRate={business.vatRate}
      // The expense side of the page is the owner's alone, the same rule the
      // Payments page keeps. A supervisor sees the bills and nothing else.
      canSeeExpenses={viewer.role === "owner"}
      // Dates start on the workspace's calendar, not the browser's.
      today={dayKeyInZone(new Date(), business.timeZone)}
    />
  )
}

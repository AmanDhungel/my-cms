import type { Metadata } from "next"

import { SalesView } from "@/components/dashboard/sales/sales-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Sales · EMS" }

export default async function SalesPage() {
  // Owners and supervisors only, the same as Inventory beside it.
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  // The dialog needs the saved rate to label its VAT switch.
  return <SalesView vatRate={business.vatRate} />
}

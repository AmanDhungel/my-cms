import type { Metadata } from "next"

import { InventoryView } from "@/components/dashboard/inventory/inventory-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Inventory · EMS" }

export default async function InventoryPage() {
  // Owners and supervisors only; an employee lands back on their dashboard.
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  // Dates start on the workspace's calendar, not the browser's.
  return <InventoryView today={dayKeyInZone(new Date(), business.timeZone)} />
}

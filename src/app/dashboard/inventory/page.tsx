import type { Metadata } from "next"

import { InventoryView } from "@/components/dashboard/inventory/inventory-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Inventory · EMS" }

export default async function InventoryPage() {
  // Owners and supervisors only; an employee lands back on their dashboard.
  await requirePageRole("owner", "supervisor")
  return <InventoryView />
}

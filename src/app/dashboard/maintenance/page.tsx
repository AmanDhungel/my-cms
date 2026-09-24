import type { Metadata } from "next"

import { MaintenanceView } from "@/components/dashboard/maintenance/maintenance-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Maintenance · EMS" }

/**
 * The repair bench.
 *
 * Owners and supervisors both: a supervisor runs the workshop, and an item
 * that came in this morning is no use written down tomorrow.
 */
export default async function MaintenancePage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  // "Past due" is measured against the workspace's calendar, not the browser's.
  return <MaintenanceView today={dayKeyInZone(new Date(), business.timeZone)} />
}

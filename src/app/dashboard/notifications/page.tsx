import type { Metadata } from "next"

import { NotificationsView } from "@/components/dashboard/notifications-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { getWorkspace } from "@/lib/workspace"

export const metadata: Metadata = { title: "Notifications · EMS" }

export default async function NotificationsPage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await getWorkspace(viewer.businessId)

  return <NotificationsView timeZone={business.timeZone} />
}

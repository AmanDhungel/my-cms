import type { Metadata } from "next"

import { TicketsView } from "@/components/dashboard/tickets/tickets-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { getWorkspace } from "@/lib/workspace"

export const metadata: Metadata = { title: "All tickets · EMS" }

export default async function TicketsPage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await getWorkspace(viewer.businessId)

  return <TicketsView canAssign timeZone={business.timeZone} />
}

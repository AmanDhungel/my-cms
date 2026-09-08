import type { Metadata } from "next"

import { RequestsView } from "@/components/dashboard/employee/requests-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Requests · EMS" }

export default async function RequestsPage() {
  await requirePageRole("employee")
  return <RequestsView />
}

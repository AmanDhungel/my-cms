import type { Metadata } from "next"

import { SchedulesView } from "@/components/dashboard/operations/schedules-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Employee schedules · EMS" }

export default async function SchedulesPage() {
  await requirePageRole("owner", "supervisor")
  return <SchedulesView />
}

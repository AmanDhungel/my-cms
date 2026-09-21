import type { Metadata } from "next"

import { CalendarView } from "@/components/dashboard/operations/calendar-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Calendar · EMS" }

export default async function CalendarPage() {
  await requirePageRole("owner", "supervisor")
  return <CalendarView />
}

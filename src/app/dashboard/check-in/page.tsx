import type { Metadata } from "next"

import { CheckInView } from "@/components/dashboard/employee/check-in-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Check in · EMS" }

export default async function CheckInPage() {
  await requirePageRole("employee")
  return <CheckInView />
}

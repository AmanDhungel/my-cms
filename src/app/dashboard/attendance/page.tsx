import type { Metadata } from "next"

import { AttendanceView } from "@/components/dashboard/employee/attendance-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Attendance · EMS" }

export default async function AttendancePage() {
  await requirePageRole("employee")
  return <AttendanceView />
}

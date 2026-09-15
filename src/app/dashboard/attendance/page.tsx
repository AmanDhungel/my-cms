import type { Metadata } from "next"

import { CrewAttendanceView } from "@/components/dashboard/attendance/crew-attendance-view"
import { AttendanceView } from "@/components/dashboard/employee/attendance-view"
import { loadViewer } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Attendance · EMS" }

/**
 * The same route for everyone, showing each side their own question. A crew
 * member reads their own month; whoever runs the workspace reads the day
 * across everybody.
 */
export default async function AttendancePage() {
  const viewer = await loadViewer()

  return viewer.role === "employee" ? <AttendanceView /> : <CrewAttendanceView />
}

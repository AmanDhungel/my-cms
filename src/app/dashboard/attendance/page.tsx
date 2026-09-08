import type { Metadata } from "next"

import {
  EmployeeScreen,
  PhoneEmpty,
  PhoneStat,
} from "@/components/dashboard/employee/screen"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Attendance · EMS" }

export default async function AttendancePage() {
  await requirePageRole("employee")

  return (
    <EmployeeScreen eyebrow="This month" title="Attendance">
      <div className="grid grid-cols-3 gap-2 lg:gap-3.5">
        <PhoneStat label="PRESENT" value={<span className="text-n-400">—</span>} />
        <PhoneStat label="LATE" value={<span className="text-n-400">—</span>} />
        <PhoneStat label="LEAVE" value={<span className="text-n-400">—</span>} />
      </div>
      <PhoneEmpty message="No attendance recorded yet. Days fill in here each time you check in to a task inside its geofence." />
    </EmployeeScreen>
  )
}

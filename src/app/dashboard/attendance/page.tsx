import type { Metadata } from "next"

import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Attendance · EMS" }

export default async function AttendancePage() {
  await requirePageRole("employee")

  return (
    <EmployeeScreen eyebrow="This month" title="Attendance">
      <div className="flex gap-2 px-5 pb-4">
        <Stat label="PRESENT" value="—" />
        <Stat label="LATE" value="—" />
        <Stat label="LEAVE" value="—" />
      </div>
      <div className="px-5 pb-6">
        <PhoneEmpty message="No attendance recorded yet. Days fill in here each time you check in to a task inside its geofence." />
      </div>
    </EmployeeScreen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-n-200 flex flex-1 flex-col gap-[3px] rounded-[10px] border bg-white px-3 py-2.5">
      <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
        {label}
      </span>
      <span className="font-heading text-n-400 text-[18px] font-semibold">
        {value}
      </span>
    </div>
  )
}

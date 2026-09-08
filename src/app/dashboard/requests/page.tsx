import type { Metadata } from "next"

import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Requests · EMS" }

export default async function RequestsPage() {
  await requirePageRole("employee")

  return (
    <EmployeeScreen eyebrow="Sent to your owner" title="Requests">
      <div className="flex flex-col gap-3 px-5 pb-6">
        <PhoneEmpty message="Nothing sent. Leave, advance and material requests will show up here with whatever your owner decided." />
        <p className="text-n-500 m-0 px-1 text-[12.5px] leading-relaxed">
          Raising a request needs the approvals store, which isn&rsquo;t built
          yet. Your account, shift and workspace are real — that part is live.
        </p>
      </div>
    </EmployeeScreen>
  )
}

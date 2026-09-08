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
      <PhoneEmpty message="Nothing sent. Leave, advance and material requests will show up here with whatever your owner decided." />
      <p className="text-n-500 m-0 max-w-[62ch] px-1 text-[12.5px] leading-relaxed lg:px-0 lg:text-[13.5px]">
        Raising a request needs the approvals store, which isn&rsquo;t built
        yet. Your account, shift and workspace are real — that part is live.
      </p>
    </EmployeeScreen>
  )
}

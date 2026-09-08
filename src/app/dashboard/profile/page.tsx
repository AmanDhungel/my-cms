import type { Metadata } from "next"

import { EmployeeScreen } from "@/components/dashboard/employee/screen"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { initialsOf } from "@/components/dashboard/viewer"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Business } from "@/models/business"
import { User, toUserDTO } from "@/models/user"

export const metadata: Metadata = { title: "Profile · EMS" }

export default async function ProfilePage() {
  const viewer = await requirePageRole("employee")

  await connectToDatabase()

  const [me, business] = await Promise.all([
    User.findById(viewer.id).orFail(),
    Business.findById(viewer.businessId).orFail(),
  ])

  const user = toUserDTO(me)

  return (
    <EmployeeScreen eyebrow={business.name} title="Your profile">
      <div className="border-n-200 flex items-center gap-3.5 rounded-[14px] border bg-white p-[15px] lg:gap-5 lg:p-6">
        <span
          aria-hidden
          className="font-heading bg-p-100 text-p-700 flex size-[46px] items-center justify-center rounded-full text-[15px] font-semibold lg:size-[60px] lg:text-[19px]"
        >
          {initialsOf(user.name)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold lg:text-[19px]">
            {user.name}
          </span>
          <span className="text-n-500 font-mono text-[11px] tracking-[0.06em] uppercase">
            {user.role}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3.5">
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={user.phone} />
        <Row label="Shift" value={user.shift ?? "Not set"} />
        <Row label="Workspace" value={business.name} />
      </div>

      <SignOutButton className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2.5 text-center text-[13.5px] font-semibold transition-colors lg:self-start lg:px-5" />
    </EmployeeScreen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-n-200 flex items-center justify-between gap-3 rounded-[10px] border bg-white px-3.5 py-2.5 lg:flex-col lg:items-start lg:gap-1.5 lg:rounded-xl lg:px-4 lg:py-3.5">
      <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em] uppercase">
        {label}
      </span>
      <span className="truncate text-[13.5px] font-medium lg:text-[15px]">
        {value}
      </span>
    </div>
  )
}

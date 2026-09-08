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
      <div className="flex flex-col gap-4 px-5 pb-6">
        <div className="border-n-200 flex items-center gap-3.5 rounded-[14px] border bg-white p-[15px]">
          <span
            aria-hidden
            className="font-heading bg-p-100 text-p-700 flex size-[46px] items-center justify-center rounded-full text-[15px] font-semibold"
          >
            {initialsOf(user.name)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">
              {user.name}
            </span>
            <span className="text-n-500 font-mono text-[11px] tracking-[0.06em] uppercase">
              {user.role}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="Shift" value={user.shift ?? "Not set"} />
          <Row label="Workspace" value={business.name} />
        </div>

        <SignOutButton className="border-n-300 text-n-700 rounded-md border bg-white px-3 py-2.5 text-center text-[13.5px] font-semibold" />
      </div>
    </EmployeeScreen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-n-200 flex items-center justify-between gap-3 rounded-[10px] border bg-white px-3.5 py-2.5">
      <span className="text-n-500 font-mono text-[10.5px] tracking-[0.06em] uppercase">
        {label}
      </span>
      <span className="truncate text-[13.5px] font-medium">{value}</span>
    </div>
  )
}

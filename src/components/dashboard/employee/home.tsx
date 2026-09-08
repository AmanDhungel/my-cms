import Link from "next/link"

import { auth } from "@/auth"
import { BellIcon } from "@/components/dashboard/nav-icons"
import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/models/user"

export async function EmployeeHome({ name }: { name: string }) {
  const session = await auth()
  await connectToDatabase()

  const user = await User.findById(session!.user.id)
  const shift = user?.shift ?? "Not set"

  return (
    <EmployeeScreen
      eyebrow={shortDate()}
      title="Today's tasks"
      aside={<BellChip />}
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">
        <div className="border-n-200 flex flex-col gap-[3px] rounded-[10px] border bg-white px-3 py-2.5 lg:gap-2 lg:rounded-xl lg:p-4">
          <span className="text-n-500 font-mono text-[10px] tracking-[0.06em] lg:text-[10.5px]">
            SHIFT
          </span>
          <span className="text-[15px] font-semibold lg:text-[22px]">
            {shift}
          </span>
        </div>

        <div className="border-p-400 bg-p-50 flex flex-col gap-[3px] rounded-[10px] border px-3 py-2.5 lg:gap-2 lg:rounded-xl lg:p-4">
          <span className="text-p-600 font-mono text-[10px] tracking-[0.06em] lg:text-[10.5px]">
            ATTENDANCE
          </span>
          <span className="text-p-700 flex items-center gap-1.5 text-[15px] font-semibold lg:text-[22px]">
            <span aria-hidden className="bg-n-400 size-[7px] rounded-full" />
            Not checked in
          </span>
        </div>

        <div className="border-n-200 col-span-2 flex flex-col gap-[3px] rounded-[10px] border bg-white px-3 py-2.5 lg:col-span-2 lg:gap-2 lg:rounded-xl lg:p-4">
          <span className="text-n-500 font-mono text-[10px] tracking-[0.06em] lg:text-[10.5px]">
            ASSIGNED TO YOU
          </span>
          <span className="text-n-400 text-[15px] font-semibold lg:text-[22px]">
            Nothing yet
          </span>
        </div>
      </div>

      <PhoneEmpty
        message={`Nothing assigned to you yet, ${firstName(name)}. Tasks your owner assigns will show up here with the site, the time window and the check-in radius.`}
      />

      <Link
        href="/dashboard/profile"
        className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2.5 text-center text-[13.5px] font-semibold transition-colors lg:self-start lg:px-5"
      >
        Check your details
      </Link>
    </EmployeeScreen>
  )
}

function BellChip() {
  return (
    <Link
      href="/dashboard/requests"
      aria-label="Requests"
      className="border-n-200 bg-n-100 text-n-700 hover:bg-n-200/60 flex size-[34px] items-center justify-center rounded-full border transition-colors"
    >
      <BellIcon className="size-4" />
    </Link>
  )
}

function shortDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date())
    .toUpperCase()
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there"
}

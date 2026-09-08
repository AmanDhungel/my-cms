import type { Metadata } from "next"
import Link from "next/link"

import { auth } from "@/auth"
import { EmployeeHome } from "@/components/dashboard/employee/home"
import {
  DashboardMain,
  Dot,
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { connectToDatabase } from "@/lib/mongodb"
import { Invite } from "@/models/invite"
import { User } from "@/models/user"

export const metadata: Metadata = { title: "Dashboard · EMS" }

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user

  if (user.role === "employee") {
    return <EmployeeHome name={user.name ?? ""} />
  }

  await connectToDatabase()

  const [crew, pendingInvites] = await Promise.all([
    User.countDocuments({ business: user.businessId }),
    Invite.countDocuments({
      business: user.businessId,
      acceptedAt: { $exists: false },
    }),
  ])

  return (
    <DashboardMain>
      <PageHeading
        eyebrow={longDate()}
        title={`${greeting()}, ${firstName(user.name)}`}
        subtitle={`${crew} ${crew === 1 ? "person" : "people"} in this workspace${
          pendingInvites > 0
            ? ` · ${pendingInvites} invite${pendingInvites === 1 ? "" : "s"} not accepted yet`
            : ""
        }.`}
        actions={
          <Link href="/dashboard/people" className={primaryButtonClass}>
            Invite someone
          </Link>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="CREW MEMBERS"
          value={crew}
          hint={
            <>
              <Dot className="bg-s-done" />
              including you
            </>
          }
        />
        <StatCard
          label="PENDING INVITES"
          value={pendingInvites}
          hint={
            <>
              <Dot className="bg-s-material" />
              links sent, not accepted
            </>
          }
          accent={pendingInvites > 0}
        />
        <StatCard
          label="CHECKED IN NOW"
          value={<span className="text-n-400">—</span>}
          hint={<>check-ins arrive with the task store</>}
        />
        <StatCard
          label="AWAITING YOU"
          value={<span className="text-n-400">—</span>}
          hint={<>approvals arrive with the request store</>}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Today's tasks"
            aside={
              <Link
                href="/dashboard/tasks"
                className="text-p-600 text-[13.5px] font-semibold"
              >
                Open all tasks →
              </Link>
            }
          />
          <div className="p-[18px]">
            <EmptyState message="No tasks yet. Tasks are the next thing to build — assigning one will need a project, a location and a geofence radius." />
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel className="flex flex-col gap-3.5 p-[18px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading m-0 text-base font-semibold">
                Checked in right now
              </h2>
              <span className="text-p-600 font-mono text-[11px]">LIVE</span>
            </div>
            <EmptyState
              className="rounded-[10px] px-4 py-7"
              message="Nobody is checked in. Check-ins appear here the moment someone arrives inside a task's geofence."
            />
          </Panel>

          <Panel className="flex flex-col gap-3.5 p-[18px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading m-0 text-base font-semibold">
                Pending approvals
              </h2>
              <span className="text-n-500 font-mono text-[11px]">0</span>
            </div>
            <EmptyState
              className="rounded-[10px] px-4 py-7"
              message="Leave and advance requests from the crew will queue here for you."
            />
          </Panel>
        </div>
      </div>
    </DashboardMain>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function longDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())
}

function firstName(name?: string | null) {
  return (name ?? "").trim().split(/\s+/)[0] || "there"
}

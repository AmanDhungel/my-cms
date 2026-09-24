import type { Metadata } from "next"
import Link from "next/link"

import { auth } from "@/auth"
import { EmployeeHome } from "@/components/dashboard/employee/employee-home"
import { TicketStatusBadge } from "@/components/dashboard/ticket-status-badge"
import { DashboardCharts } from "@/components/dashboard/reports/dashboard-charts"
import { NewTicketButton } from "@/components/dashboard/tickets/new-ticket-button"
import {
  DashboardMain,
  Dot,
  EmptyState,
  PageHeading,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/dashboard/ui"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { toBusinessDTO } from "@/models/business"
import { WorkRequest, toRequestDTO } from "@/models/request"
import { Ticket, toTicketDTO } from "@/models/ticket"
import { User } from "@/models/user"

export const metadata: Metadata = { title: "Dashboard · EMS" }

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user

  await connectToDatabase()

  const business = await getWorkspace(user.businessId)

  if (user.role === "employee") {
    const me = await User.findById(user.id).select("shift")
    return (
      <EmployeeHome
        name={user.name ?? ""}
        shift={me?.shift ?? null}
        // Plain object, not the subdocument — this crosses to the client.
        office={toBusinessDTO(business).office}
      />
    )
  }

  const { start, end } = dayRangeInZone(
    dayKeyInZone(new Date(), business.timeZone),
    business.timeZone
  )

  const [crew, todayTickets, checkedIn, pendingRequests] = await Promise.all([
    User.countDocuments({ business: business._id }),
    Ticket.find({
      business: business._id,
      startAt: { $gte: start, $lt: end },
      status: { $ne: "cancelled" },
    })
      .sort({ startAt: 1 })
      .limit(6)
      .populate("assignees", "name"),
    // One ticket can have several people standing on it, so this counts
    // people on site rather than tickets with somebody on them.
    Ticket.aggregate<{ total: number }>([
      { $match: { business: business._id } },
      { $project: { n: { $size: { $ifNull: ["$openCheckIns", []] } } } },
      { $group: { _id: null, total: { $sum: "$n" } } },
    ]),
    WorkRequest.find({ business: business._id, status: "pending" })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("user", "name"),
  ])

  const tickets = todayTickets.map((ticket) => toTicketDTO(ticket))
  const onSite = checkedIn[0]?.total ?? 0
  const requests = pendingRequests.map(toRequestDTO)

  return (
    <DashboardMain>
      <PageHeading
        eyebrow={longDate(business.timeZone)}
        title={`${greeting(business.timeZone)}, ${firstName(user.name)}`}
        subtitle={`${tickets.length} ticket${tickets.length === 1 ? "" : "s"} scheduled today · ${requests.length} waiting on you.`}
        actions={
          <NewTicketButton />
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="CHECKED IN NOW"
          value={onSite}
          hint={
            <>
              <Dot className={onSite > 0 ? "bg-s-done" : "bg-n-400"} />
              {onSite > 0 ? "on site right now" : "nobody on site"}
            </>
          }
        />
        <StatCard
          label="TICKETS TODAY"
          value={tickets.length}
          hint={
            <>
              <Dot className="bg-s-progress" />
              across the workspace
            </>
          }
        />
        <StatCard
          label="CREW MEMBERS"
          value={crew}
          hint={
            <>
              <Dot className="bg-p-500" />
              including you
            </>
          }
        />
        <StatCard
          label="AWAITING YOU"
          value={requests.length}
          accent={requests.length > 0}
          hint={<>leave · advance · material</>}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Today's tickets"
            aside={
              <Link
                href="/dashboard/tickets"
                className="text-p-600 text-[13.5px] font-semibold"
              >
                Open all tickets →
              </Link>
            }
          />
          {tickets.length === 0 ? (
            <div className="p-[18px]">
              <EmptyState
                message="Nothing scheduled today. Assign a ticket with a site and a check-in area and it shows up here."
                action={<NewTicketButton />}
              />
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="border-n-200/70 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[14.5px] font-semibold">
                    {ticket.title}
                  </span>
                  <span className="text-n-500 text-[12.5px]">
                    {ticket.site} ·{" "}
                    {ticket.assignees.map((member) => member.name).join(", ") ||
                      "Unassigned"}{" "}
                    ·{" "}
                    <span className="font-mono text-[11px]">
                      {clock(ticket.startAt, business.timeZone)}–
                      {clock(ticket.endAt, business.timeZone)}
                    </span>
                  </span>
                </div>
                <TicketStatusBadge status={ticket.status} />
              </div>
            ))
          )}
        </Panel>

        <Panel className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading m-0 text-base font-semibold">
              Pending approvals
            </h2>
            <span className="text-n-500 font-mono text-[11px]">
              {requests.length}
            </span>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              className="rounded-[10px] px-4 py-7"
              message="Nothing waiting. Leave, advance and material requests queue here."
            />
          ) : (
            <>
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border-n-200 flex flex-col gap-1 border-b border-dashed pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="text-[13.5px] font-semibold">
                    {request.user?.name ?? "Someone"}
                  </span>
                  <span className="text-n-600 text-[12.5px]">
                    {request.message}
                  </span>
                  <span className="text-a-700 bg-a-50 w-fit rounded px-1.5 py-0.5 font-mono text-[10.5px] uppercase">
                    {request.kind}
                  </span>
                </div>
              ))}
              <Link
                href="/dashboard/approvals"
                className="text-p-600 text-[13.5px] font-semibold"
              >
                Open approvals →
              </Link>
            </>
          )}
        </Panel>
      </div>

      {/* The crew never reach this page — they are returned an EmployeeHome
          above — so these need no guard of their own. */}
      <DashboardCharts />
    </DashboardMain>
  )
}

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function longDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function firstName(name?: string | null) {
  return (name ?? "").trim().split(/\s+/)[0] || "there"
}

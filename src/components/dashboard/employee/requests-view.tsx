"use client"

import * as React from "react"
import { cn } from "cn"

import { ErrorPanel } from "@/components/dashboard/employee/employee-home"
import { RequestDialog } from "@/components/dashboard/employee/request-dialog"
import {
  EmployeeScreen,
  PhoneEmpty,
} from "@/components/dashboard/employee/screen"
import { CardsSkeleton } from "@/components/dashboard/skeletons"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { useRequests } from "@/lib/queries"
import type { RequestDTO } from "@/models/request"
import type { RequestStatus } from "@/lib/work-constants"

const STATUS_LOOK: Record<RequestStatus, string> = {
  pending: "bg-a-50 text-a-700 border-a-200",
  approved: "bg-p-100 text-p-700 border-p-200",
  rejected: "bg-[#fdecec] text-s-overdue border-[#f7d4d5]",
}

const FILTERS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export function RequestsView() {
  const [filter, setFilter] = React.useState<RequestStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const query = useRequests()
  const all = query.data?.requests ?? []
  const visible = filter === "all" ? all : all.filter((r) => r.status === filter)

  return (
    <EmployeeScreen
      eyebrow="Sent to your owner"
      title="Requests"
      aside={
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-a-400 text-a-900 flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold shadow-[0_3px_10px_rgba(200,127,15,0.22)] hover:brightness-[1.06]"
        >
          <PlusIcon className="size-3.5" />
          New
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setFilter(chip.value)}
            aria-pressed={filter === chip.value}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
              filter === chip.value
                ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
            )}
          >
            {chip.label}
            {chip.value === "pending" && query.data?.counts.pending
              ? ` · ${query.data.counts.pending}`
              : ""}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <CardsSkeleton cards={3} />
      ) : query.isError ? (
        <ErrorPanel onRetry={() => void query.refetch()} />
      ) : visible.length === 0 ? (
        <PhoneEmpty
          message={
            all.length === 0
              ? "Nothing sent yet. Leave, advance and material requests all go to your owner from here."
              : "Nothing in that state."
          }
        />
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {visible.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}

      <RequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </EmployeeScreen>
  )
}

export function RequestCard({
  request,
  children,
}: {
  request: RequestDTO
  children?: React.ReactNode
}) {
  return (
    <div className="border-n-200 flex flex-col gap-2.5 rounded-[14px] border bg-white p-[15px]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-n-500 font-mono text-[10px] tracking-[0.06em] uppercase">
            {request.kind} · {shortDate(request.createdAt)}
          </span>
          <span className="text-[15px] font-semibold">
            {headline(request)}
          </span>
          {request.user?.name ? (
            <span className="text-n-500 text-[12.5px]">
              {request.user.name}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize",
            STATUS_LOOK[request.status]
          )}
        >
          {request.status === "pending" ? "Waiting" : request.status}
        </span>
      </div>

      <p className="text-n-600 m-0 text-[13px] leading-relaxed">
        {request.message}
      </p>

      {request.decisionNote ? (
        <p className="border-n-300 text-n-600 m-0 border-l-2 pl-3 text-[12.5px] leading-relaxed">
          Owner: {request.decisionNote}
        </p>
      ) : null}

      {children}
    </div>
  )
}

function headline(request: RequestDTO) {
  if (request.kind === "leave" && request.startDate && request.endDate) {
    return request.startDate === request.endDate
      ? `Leave on ${longDate(request.startDate)}`
      : `Leave ${longDate(request.startDate)} – ${longDate(request.endDate)}`
  }
  if (request.kind === "advance" && request.amount !== null) {
    return `Advance of ${request.amount.toLocaleString()}`
  }
  return "Material needed"
}

function longDate(dayKey: string) {
  const [year, m, d] = dayKey.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, d)))
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .toUpperCase()
}

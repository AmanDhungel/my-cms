"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { RequestCard } from "@/components/dashboard/employee/requests-view"
import { CardsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { reportMutationError, useDecideRequest, useRequests } from "@/lib/queries"
import type { RequestDTO } from "@/models/request"
import type { RequestStatus } from "@/lib/work-constants"

const FILTERS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
]

export function ApprovalsView({ canDecide }: { canDecide: boolean }) {
  const [filter, setFilter] = React.useState<RequestStatus | "all">("pending")
  const query = useRequests()

  const all = query.data?.requests ?? []
  const visible = filter === "all" ? all : all.filter((r) => r.status === filter)
  const counts = query.data?.counts

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Approvals"
        subtitle="Leave, advance and material requests the crew sends you."
      />

      {query.isPending ? (
        <StatGridSkeleton count={3} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <StatCard
            label="WAITING"
            value={counts?.pending ?? 0}
            accent={(counts?.pending ?? 0) > 0}
          />
          <StatCard label="APPROVED" value={counts?.approved ?? 0} />
          <StatCard label="REJECTED" value={counts?.rejected ?? 0} />
        </div>
      )}

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
          </button>
        ))}
      </div>

      {query.isPending ? (
        <CardsSkeleton cards={3} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load requests. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          message={
            filter === "pending"
              ? "Nothing waiting on you."
              : "Nothing in that state."
          }
        />
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
          {visible.map((request) => (
            <RequestCard key={request.id} request={request}>
              {canDecide && request.status === "pending" ? (
                <Decision request={request} />
              ) : null}
            </RequestCard>
          ))}
        </div>
      )}
    </DashboardMain>
  )
}

function Decision({ request }: { request: RequestDTO }) {
  const [note, setNote] = React.useState("")
  const mutation = useDecideRequest(request.id)

  function decide(status: "approved" | "rejected") {
    if (mutation.isPending) return
    mutation.mutate(
      { status, decisionNote: note.trim() || undefined },
      {
        onSuccess: () =>
          toast.success(status === "approved" ? "Approved" : "Rejected"),
        onError: (error) => reportMutationError(error),
      }
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note (optional)"
        className="border-n-300 focus:border-p-500 placeholder:text-n-400 rounded-md border bg-white px-3 py-2 text-[13px] outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-3.5 py-2 text-[12.5px] font-semibold text-white hover:brightness-[1.07] disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={mutation.isPending}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

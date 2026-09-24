"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { EyeIcon, PlusIcon } from "@/components/dashboard/nav-icons"
import { ProjectDialog } from "@/components/dashboard/projects/project-dialog"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import { TicketBoard } from "@/components/dashboard/tickets/ticket-board"
import { TicketDetailDialog } from "@/components/dashboard/tickets/ticket-detail-dialog"
import { TicketDialog } from "@/components/dashboard/tickets/ticket-dialog"
import { TicketStatusBadge } from "@/components/dashboard/ticket-status-badge"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import { formatDistance } from "@/lib/geo"
import { useTickets, type TicketScope } from "@/lib/queries"
import type { ProjectDTO } from "@/models/project"
import type { TicketDTO } from "@/models/ticket"

const SCOPES: { value: TicketScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
]

/**
 * One project's work, on the same board the whole workspace uses. The scope
 * starts at "All" rather than "Today": opening a project is a question about
 * the job, not about this morning.
 */
export function ProjectDetailView({
  project,
  canAssign,
  timeZone,
}: {
  project: ProjectDTO
  canAssign: boolean
  timeZone: string
}) {
  const [view, setView] = React.useState<"board" | "list">("board")
  const [scope, setScope] = React.useState<TicketScope>("all")
  const [newOpen, setNewOpen] = React.useState(false)
  const [editProject, setEditProject] = React.useState(false)
  const [editing, setEditing] = React.useState<TicketDTO | null>(null)
  const [viewing, setViewing] = React.useState<TicketDTO | null>(null)

  const query = useTickets(scope, project.id)
  const tickets = query.data?.tickets ?? []
  const archived = project.status === "archived"

  const counts = {
    open: tickets.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    ).length,
    inReview: tickets.filter((t) => t.status === "in_review").length,
    blocked: tickets.filter((t) => t.status === "blocked").length,
    done: tickets.filter((t) => t.status === "done").length,
  }

  return (
    <DashboardMain className="gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/projects"
          className="text-n-500 hover:text-p-600 w-fit text-[13px] font-medium"
        >
          ← All projects
        </Link>
      </div>

      <PageHeading
        eyebrow={archived ? "Archived project" : "Project"}
        title={project.name}
        subtitle={
          project.description ??
          (project.site
            ? `Default site: ${project.site}`
            : "Every ticket under this job, wherever it is scheduled.")
        }
        actions={
          canAssign ? (
            <>
              <button
                type="button"
                onClick={() => setEditProject(true)}
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3.5 py-2.5 text-[13px] font-semibold"
              >
                Edit project
              </button>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                disabled={archived}
                className={cn(primaryButtonClass, "disabled:opacity-50")}
                title={archived ? "Archived projects take no new tickets" : undefined}
              >
                <PlusIcon className="size-3.5" />
                New ticket
              </button>
            </>
          ) : null
        }
      />

      {archived ? (
        <p className="border-n-300 text-n-600 m-0 rounded-[10px] border border-dashed bg-white px-4 py-3 text-[13px]">
          This project is archived. It takes no new tickets, and anything nobody
          had started was cancelled when it was archived.
        </p>
      ) : null}

      {query.isPending ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="OPEN" value={counts.open} />
          <StatCard
            label="IN REVIEW"
            value={counts.inReview}
            accent={counts.inReview > 0}
          />
          <StatCard
            label="BLOCKED"
            value={counts.blocked}
            accent={counts.blocked > 0}
          />
          <StatCard label="COMPLETED" value={counts.done} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setScope(chip.value)}
              aria-pressed={scope === chip.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                scope === chip.value
                  ? "bg-p-100 border-p-400 text-p-700 font-semibold"
                  : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="border-n-200 flex gap-0.5 rounded-md border bg-white p-0.5">
          {(["board", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={cn(
                "rounded-[5px] px-3 py-1.5 text-[12.5px] capitalize transition-colors",
                view === option
                  ? "bg-p-100 text-p-700 font-semibold"
                  : "text-n-600 hover:bg-n-100 font-medium"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load this project's tickets. Your connection may have dropped."
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
      ) : tickets.length === 0 ? (
        <EmptyState
          message={
            scope === "all"
              ? "No tickets on this project yet. Assign one with a site, a time window and a check-in radius."
              : "Nothing in this view."
          }
          action={
            canAssign && scope === "all" && !archived ? (
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className={primaryButtonClass}
              >
                New ticket
              </button>
            ) : undefined
          }
        />
      ) : view === "board" ? (
        <TicketBoard
          tickets={tickets}
          timeZone={timeZone}
          canMove={canAssign}
          onEdit={setEditing}
          onView={setViewing}
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.5fr_150px_170px_150px_84px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["TICKET / SITE", "ASSIGNEE", "WINDOW", "STATUS", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="border-n-200/70 hover:bg-n-50 grid gap-2.5 border-b px-[18px] py-3.5 last:border-b-0 lg:grid-cols-[1.5fr_150px_170px_150px_84px] lg:items-center lg:gap-3.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">{ticket.title}</span>
                <span className="text-n-500 text-[12.5px]">
                  {ticket.site} · fence {formatDistance(ticket.radiusM)}
                </span>
                {ticket.blockedReason ? (
                  <span className="text-a-700 text-[12px]">
                    Blocked: {ticket.blockedReason}
                  </span>
                ) : null}
              </div>

              <span className="text-n-700 truncate text-[13px]">
                {crewLabel(ticket)}
              </span>

              <span className="text-n-600 font-mono text-[12px]">
                {dateLabel(ticket.startAt, timeZone)} ·{" "}
                {clock(ticket.startAt, timeZone)}–{clock(ticket.endAt, timeZone)}
              </span>

              <div className="flex flex-col items-start gap-1">
                <TicketStatusBadge status={ticket.status} />
                {ticket.onSite.length > 0 ? (
                  <span className="text-p-600 font-mono text-[10.5px]">
                    {ticket.onSite.length} ON SITE
                  </span>
                ) : null}
              </div>

              <div className="flex gap-1.5 lg:justify-end">
                <button
                  type="button"
                  aria-label="View details"
                  onClick={() => setViewing(ticket)}
                  className="border-n-300 text-n-700 hover:bg-n-100 flex items-center justify-center rounded-md border bg-white px-2 py-1.5"
                >
                  <EyeIcon className="size-3.5" />
                </button>
                {canAssign ? (
                  <button
                    type="button"
                    onClick={() => setEditing(ticket)}
                    disabled={
                      ticket.status === "done" || ticket.status === "cancelled"
                    }
                    className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </Panel>
      )}

      {viewing ? (
        <TicketDetailDialog
          key={viewing.id}
          ticket={viewing}
          timeZone={timeZone}
          open
          onClose={() => setViewing(null)}
        />
      ) : null}

      {canAssign ? (
        <>
          <TicketDialog
            open={newOpen}
            onClose={() => setNewOpen(false)}
            projectId={project.id}
          />
          {editing ? (
            <TicketDialog
              key={editing.id}
              ticket={editing}
              open
              onClose={() => setEditing(null)}
            />
          ) : null}
          <ProjectDialog
            open={editProject}
            project={project}
            onClose={() => setEditProject(false)}
          />
        </>
      ) : null}
    </DashboardMain>
  )
}

function crewLabel(ticket: TicketDTO) {
  const [first, ...rest] = ticket.assignees
  if (!first) return "Unassigned"
  return rest.length > 0 ? `${first.name} +${rest.length}` : first.name
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

function dateLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
  })
    .format(new Date(iso))
    .toUpperCase()
}

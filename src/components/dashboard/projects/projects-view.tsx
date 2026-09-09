"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { PlusIcon } from "@/components/dashboard/nav-icons"
import { ProjectDialog } from "@/components/dashboard/projects/project-dialog"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  reportMutationError,
  useProjects,
  useSetProjectStatus,
  type ProjectWithCounts,
} from "@/lib/queries"
import type { ProjectStatus } from "@/lib/work-constants"

const FILTERS: { value: ProjectStatus | "all"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
]

export function ProjectsView({ canManage }: { canManage: boolean }) {
  const [filter, setFilter] = React.useState<ProjectStatus | "all">("active")
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const query = useProjects()
  const all = query.data?.projects ?? []
  const visible = filter === "all" ? all : all.filter((p) => p.status === filter)

  const totals = all.reduce(
    (sum, project) => ({
      active: sum.active + (project.status === "active" ? 1 : 0),
      open: sum.open + project.tasks.open,
      blocked: sum.blocked + project.tasks.blocked,
    }),
    { active: 0, open: 0, blocked: 0 }
  )

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Projects"
        subtitle="A project groups located tasks under one job. Every task belongs to one."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New project
            </button>
          ) : null
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="PROJECTS" value={all.length} />
          <StatCard label="ACTIVE" value={totals.active} />
          <StatCard label="OPEN TASKS" value={totals.open} />
          <StatCard
            label="BLOCKED"
            value={totals.blocked}
            accent={totals.blocked > 0}
          />
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
        <RowsSkeleton rows={3} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load projects. Your connection may have dropped."
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
            all.length === 0
              ? "No projects yet. Create one and you can start assigning tasks to it."
              : "Nothing in that state."
          }
          action={
            canManage && all.length === 0 ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className={primaryButtonClass}
              >
                New project
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {canManage ? (
        <ProjectDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={() => toast.success("Project ready for tasks")}
        />
      ) : null}
    </DashboardMain>
  )
}

function ProjectCard({
  project,
  canManage,
}: {
  project: ProjectWithCounts
  canManage: boolean
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const mutation = useSetProjectStatus(project.id)
  const archived = project.status === "archived"

  function toggle() {
    if (mutation.isPending) return
    mutation.mutate(archived ? "active" : "archived", {
      onSuccess: () =>
        toast.success(archived ? "Project reopened" : "Project archived"),
      onError: (error) => reportMutationError(error),
    })
  }

  return (
    <Panel
      className={cn(
        "flex flex-col gap-3 p-[18px]",
        archived && "bg-n-100/60 border-dashed"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-heading text-[16px] font-semibold">
            {project.name}
          </span>
          {project.site ? (
            <span className="text-n-500 text-[12.5px]">{project.site}</span>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize",
            archived
              ? "border-n-300 text-n-500 bg-white"
              : "border-p-200 bg-p-100 text-p-700"
          )}
        >
          {project.status}
        </span>
      </div>

      {project.description ? (
        <p className="text-n-600 m-0 line-clamp-2 text-[13px] leading-relaxed">
          {project.description}
        </p>
      ) : null}

      <div className="border-n-200 grid grid-cols-3 gap-2 border-t pt-3">
        <Count label="OPEN" value={project.tasks.open} />
        <Count
          label="BLOCKED"
          value={project.tasks.blocked}
          tone={project.tasks.blocked > 0 ? "warn" : "plain"}
        />
        <Count label="DONE" value={project.tasks.done} />
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2 text-[12.5px] font-semibold"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={mutation.isPending}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
          >
            {mutation.isPending
              ? "Saving…"
              : archived
                ? "Reopen project"
                : "Archive project"}
          </button>
          <ProjectDialog
            open={editOpen}
            project={project}
            onClose={() => setEditOpen(false)}
          />
        </div>
      ) : null}

      {!archived ? null : (
        <span className="text-n-500 text-[12px]">
          Archived projects take no new tasks; unstarted ones were cancelled.
        </span>
      )}
    </Panel>
  )
}

function Count({
  label,
  value,
  tone = "plain",
}: {
  label: string
  value: number
  tone?: "plain" | "warn"
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-[18px] font-semibold",
          tone === "warn" && "text-a-700"
        )}
      >
        {value}
      </span>
    </span>
  )
}

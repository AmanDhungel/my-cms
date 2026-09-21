"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { OperationDialog } from "@/components/dashboard/operations/operation-dialog"
import { paginate, Pagination } from "@/components/dashboard/pagination"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  KIND_COPY,
  dueLabel,
  isOverdue,
  summariseOperations,
} from "@/lib/operations"
import {
  reportMutationError,
  useDeleteOperation,
  useOperations,
  useUpdateOperation,
} from "@/lib/queries"
import type { OperationKind, OperationStatus } from "@/lib/work-constants"
import type { OperationDTO } from "@/models/operation"

const PER_PAGE = 12

const FILTERS: { value: OperationStatus | "all" | "overdue"; label: string }[] = [
  { value: "scheduled", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "done", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
]

/**
 * The list behind Meetings, Installation dates, Follow-ups and Deadlines.
 * One component: the four differ in wording, not in what they hold.
 */
export function OperationsView({ kind }: { kind: OperationKind }) {
  const copy = KIND_COPY[kind]

  const [filter, setFilter] = React.useState<
    OperationStatus | "all" | "overdue"
  >("scheduled")
  const [page, setPage] = React.useState(1)
  const [adding, setAdding] = React.useState(false)
  const [editing, setEditing] = React.useState<OperationDTO | null>(null)
  const [deleting, setDeleting] = React.useState<OperationDTO | null>(null)

  const query = useOperations(kind)
  const all = React.useMemo(
    () => query.data?.operations ?? [],
    [query.data?.operations]
  )

  const visible = React.useMemo(() => {
    if (filter === "all") return all
    if (filter === "overdue") return all.filter(isOverdue)
    return all.filter((one) => one.status === filter)
  }, [all, filter])

  const paged = paginate(visible, page, PER_PAGE)
  const counts = summariseOperations(all)

  // Changing the filter can leave you past the end of a shorter list, so the
  // reset rides along with the change rather than chasing it from an effect.
  function choose(next: typeof filter) {
    setFilter(next)
    setPage(1)
  }

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow={copy.eyebrow}
        title={copy.plural}
        subtitle={copy.subtitle}
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={primaryButtonClass}
          >
            <PlusIcon className="size-3.5" />
            New {copy.singular.toLowerCase()}
          </button>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="OPEN" value={counts.open} />
          <StatCard
            label="OVERDUE"
            value={counts.overdue}
            accent={counts.overdue > 0}
          />
          <StatCard label="NEXT 7 DAYS" value={counts.soon} />
          <StatCard label="CLOSED" value={counts.done} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => choose(chip.value)}
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
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load these. Your connection may have dropped."
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
          message={all.length === 0 ? copy.empty : "Nothing in this view."}
          action={
            all.length === 0 ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={primaryButtonClass}
              >
                New {copy.singular.toLowerCase()}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Panel className="overflow-hidden">
            <div className="border-n-200 bg-n-100 hidden grid-cols-[150px_1.5fr_1fr_110px_150px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
              {["WHEN", "WHAT", "WHO / WHERE", "STATE", ""].map((head) => (
                <span
                  key={head}
                  className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                >
                  {head}
                </span>
              ))}
            </div>

            {paged.rows.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                kind={kind}
                onEdit={() => setEditing(entry)}
                onDelete={() => setDeleting(entry)}
              />
            ))}
          </Panel>

          <Pagination
            page={paged.page}
            pageCount={paged.pageCount}
            from={paged.from}
            to={paged.to}
            total={visible.length}
            noun={copy.plural.toLowerCase()}
            onPage={setPage}
          />
        </>
      )}

      <OperationDialog
        open={adding}
        kind={kind}
        onClose={() => setAdding(false)}
      />
      {editing ? (
        <OperationDialog
          key={editing.id}
          open
          kind={kind}
          entry={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteOperationDialog
          key={deleting.id}
          entry={deleting}
          kind={kind}
          open
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </DashboardMain>
  )
}

function Row({
  entry,
  kind,
  onEdit,
  onDelete,
}: {
  entry: OperationDTO
  kind: OperationKind
  onEdit: () => void
  onDelete: () => void
}) {
  const copy = KIND_COPY[kind]
  const status = useUpdateOperation(entry.id)
  const late = isOverdue(entry)
  const closed = entry.status !== "scheduled"

  function flip(next: OperationStatus) {
    if (status.isPending) return
    status.mutate(
      { status: next },
      {
        onSuccess: () =>
          toast.success(
            next === "done" ? `${entry.title} closed` : `${entry.title} reopened`
          ),
        onError: (error) => reportMutationError(error),
      }
    )
  }

  return (
    <div className="border-n-200/70 hover:bg-n-50 grid gap-2.5 border-b px-[18px] py-3.5 last:border-b-0 lg:grid-cols-[150px_1.5fr_1fr_110px_150px] lg:items-center lg:gap-3.5">
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-mono text-[12.5px]",
            late ? "text-s-overdue font-semibold" : "text-n-700"
          )}
        >
          {dateLabel(entry.startAt)}
          {entry.allDay ? "" : ` · ${clock(entry.startAt)}`}
        </span>
        <span
          className={cn(
            "text-[11.5px]",
            late ? "text-s-overdue" : "text-n-500"
          )}
        >
          {closed ? copy.states[entry.status] : dueLabel(entry.startAt)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[14.5px] font-semibold">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", copy.dot)}
          />
          <span className={cn(closed && "text-n-500 line-through")}>
            {entry.title}
          </span>
          {entry.priority !== "normal" ? (
            <span className="text-a-700 bg-a-50 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
              {entry.priority}
            </span>
          ) : null}
        </span>
        {entry.details ? (
          <span className="text-n-500 line-clamp-1 text-[12.5px]">
            {entry.details}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-n-700 truncate text-[13px]">
          {entry.assignees.map((one) => one.name).join(", ") || "Nobody yet"}
        </span>
        <span className="text-n-500 truncate text-[12px]">
          {[entry.customer?.name, entry.location, entry.project?.name]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </div>

      <span
        className={cn(
          "w-fit rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
          entry.status === "done"
            ? "border-p-200 bg-p-100 text-p-700"
            : entry.status === "cancelled"
              ? "border-n-300 text-n-500 bg-white"
              : late
                ? "border-[#f7d4d5] bg-[#fdecec] text-s-overdue"
                : "border-a-200 bg-a-50 text-a-700"
        )}
      >
        {late && entry.status === "scheduled" ? "Overdue" : copy.states[entry.status]}
      </span>

      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        <button
          type="button"
          onClick={() => flip(entry.status === "done" ? "scheduled" : "done")}
          disabled={status.isPending}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
        >
          {entry.status === "done" ? copy.reopen : copy.complete}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${entry.title}`}
          onClick={onDelete}
          className="border-n-300 text-n-500 hover:text-s-overdue hover:bg-n-100 rounded-md border bg-white px-2 py-1.5 text-[12.5px] font-semibold"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** Unlike a task, one of these really is deleted — nothing points at it. */
function DeleteOperationDialog({
  entry,
  kind,
  open,
  onClose,
}: {
  entry: OperationDTO
  kind: OperationKind
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeleteOperation(entry.id)
  const copy = KIND_COPY[kind]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Delete {entry.title}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {dateLabel(entry.startAt)}
            {entry.allDay ? "" : ` · ${clock(entry.startAt)}`}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          This removes the {copy.singular.toLowerCase()} from the list and the
          calendar. It can&rsquo;t be undone — cancel it instead if you want to
          keep the record.
        </p>

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (mutation.isPending) return
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${entry.title} deleted`)
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
    .format(new Date(iso))
    .toUpperCase()
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

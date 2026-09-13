"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import type { AdminBusiness, AdminProject, AdminUser } from "@/lib/admin"
import {
  reportMutationError,
  useAdminOverview,
  useBlockBusiness,
  useBlockUser,
} from "@/lib/queries"

const PER_PAGE = 10

type Tab = "businesses" | "users" | "projects"

/** What the block dialog is about to do, whichever kind of row it came from. */
type Target =
  | { kind: "business"; id: string; name: string; blocked: boolean; users: number }
  | { kind: "user"; id: string; name: string; blocked: boolean; email: string }

/**
 * The whole system in three lists. Read-only apart from the one thing a
 * super admin can do from here: shut an account or a workspace out.
 */
export function AdminView({ admin }: { admin: { name: string; email: string } }) {
  const [tab, setTab] = React.useState<Tab>("businesses")
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [target, setTarget] = React.useState<Target | null>(null)

  const query = useAdminOverview()
  const businesses = query.data?.businesses ?? []
  const users = query.data?.users ?? []
  const projects = query.data?.projects ?? []

  const needle = search.trim().toLowerCase()
  const match = (...fields: (string | null | undefined)[]) =>
    !needle || fields.some((field) => field?.toLowerCase().includes(needle))

  const visibleBusinesses = businesses.filter((business) =>
    match(business.name, business.owner?.email, business.owner?.name)
  )
  const visibleUsers = users.filter((user) =>
    match(user.name, user.email, user.phone, user.business?.name)
  )
  const visibleProjects = projects.filter((project) =>
    match(project.name, project.site, project.business?.name)
  )

  const blockedUsers = users.filter(
    (user) => user.blockedAt || user.business?.blockedAt
  ).length
  const blockedBusinesses = businesses.filter((b) => b.blockedAt).length

  function switchTab(next: Tab) {
    setTab(next)
    setPage(1)
  }

  return (
    <div className="bg-n-50 min-h-screen">
      <header className="border-n-200 bg-p-700 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b px-7 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="bg-a-400 flex size-6 items-center justify-center rounded-[7px]"
          >
            <span className="bg-p-700 size-2 rounded-full" />
          </span>
          <span className="font-heading text-[15px] font-bold tracking-[-0.01em] text-white">
            EMS
          </span>
          <span className="text-a-400 font-mono text-[11px] tracking-[0.08em]">
            SUPER ADMIN
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden flex-col items-end sm:flex">
            <span className="text-[13px] font-semibold text-white">
              {admin.name}
            </span>
            <span className="text-p-100 font-mono text-[10.5px]">
              {admin.email}
            </span>
          </span>
          <Link
            href="/dashboard"
            className="rounded-md border border-white/30 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            My workspace
          </Link>
          <SignOutButton className="rounded-md border border-white/30 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10" />
        </div>
      </header>

      <main className="flex min-w-0 flex-col gap-5 px-5 pt-7 pb-12 sm:px-8">
        <PageHeading
          eyebrow="Every workspace"
          title="Super admin"
          subtitle="Everything on this deployment, and the switch that shuts an account or a workspace out."
        />

        {query.isPending ? (
          <StatGridSkeleton count={4} />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="BUSINESSES" value={businesses.length} />
            <StatCard label="USERS" value={users.length} />
            <StatCard label="PROJECTS" value={projects.length} />
            <StatCard
              label="BLOCKED"
              value={blockedUsers}
              accent={blockedUsers > 0}
              hint={
                blockedBusinesses > 0
                  ? `${blockedBusinesses} workspace${blockedBusinesses === 1 ? "" : "s"} blocked`
                  : undefined
              }
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="border-n-200 flex gap-0.5 rounded-md border bg-white p-0.5">
            {(
              [
                ["businesses", "Businesses"],
                ["users", "Users"],
                ["projects", "Projects"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchTab(value)}
                aria-pressed={tab === value}
                className={cn(
                  "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors",
                  tab === value
                    ? "bg-p-100 text-p-700 font-semibold"
                    : "text-n-600 hover:bg-n-100 font-medium"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="border-n-200 flex min-w-[230px] items-center gap-2 rounded-md border bg-white px-2.5 py-2">
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search everything"
              className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
            />
          </label>
        </div>

        {query.isPending ? (
          <RowsSkeleton rows={5} />
        ) : query.isError ? (
          <EmptyState
            message="Couldn't load the system view. Your connection may have dropped."
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
        ) : tab === "businesses" ? (
          <BusinessTable
            rows={visibleBusinesses}
            page={page}
            onPage={setPage}
            onBlock={setTarget}
          />
        ) : tab === "users" ? (
          <UserTable
            rows={visibleUsers}
            page={page}
            onPage={setPage}
            onBlock={setTarget}
          />
        ) : (
          <ProjectTable rows={visibleProjects} page={page} onPage={setPage} />
        )}
      </main>

      {target ? (
        <BlockDialog
          key={`${target.kind}${target.id}`}
          target={target}
          open
          onClose={() => setTarget(null)}
        />
      ) : null}
    </div>
  )
}

function BusinessTable({
  rows,
  page,
  onPage,
  onBlock,
}: {
  rows: AdminBusiness[]
  page: number
  onPage: (next: number) => void
  onBlock: (target: Target) => void
}) {
  const shown = paginate(rows, page, PER_PAGE)

  return (
    <Panel className="overflow-hidden">
      <Head
        columns={["WORKSPACE", "OWNER", "PEOPLE", "WORK", "CREATED", ""]}
        grid="lg:grid-cols-[1.4fr_1.2fr_90px_140px_120px_110px]"
      />

      {shown.rows.map((business) => (
        <Row
          key={business.id}
          grid="lg:grid-cols-[1.4fr_1.2fr_90px_140px_120px_110px]"
          dim={Boolean(business.blockedAt)}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 truncate text-sm font-semibold">
              {business.name}
              {business.blockedAt ? <BlockedChip /> : null}
            </span>
            <span className="text-n-500 truncate text-xs">
              {business.timeZone} · {business.crewSize}
            </span>
          </span>

          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px]">
              {business.owner?.name ?? "—"}
            </span>
            <span className="text-n-500 truncate text-xs">
              {business.owner?.email ?? ""}
            </span>
          </span>

          <span className="text-n-700 font-mono text-[12.5px]">
            {business.counts.users}
          </span>

          <span className="text-n-500 text-xs">
            {business.counts.projects} projects · {business.counts.tasks} tasks
            <br />
            {business.counts.bills} bills · {business.counts.items} items
          </span>

          <span className="text-n-600 text-[12.5px]">
            {formatDate(business.createdAt)}
          </span>

          <div className="lg:justify-self-end">
            <BlockButton
              blocked={Boolean(business.blockedAt)}
              onClick={() =>
                onBlock({
                  kind: "business",
                  id: business.id,
                  name: business.name,
                  blocked: Boolean(business.blockedAt),
                  users: business.counts.users,
                })
              }
            />
          </div>
        </Row>
      ))}

      <Empty rows={rows.length} noun="workspace" />
      <Pagination
        page={shown.page}
        pageCount={shown.pageCount}
        from={shown.from}
        to={shown.to}
        total={rows.length}
        noun="businesses"
        onPage={onPage}
      />
    </Panel>
  )
}

function UserTable({
  rows,
  page,
  onPage,
  onBlock,
}: {
  rows: AdminUser[]
  page: number
  onPage: (next: number) => void
  onBlock: (target: Target) => void
}) {
  const shown = paginate(rows, page, PER_PAGE)

  return (
    <Panel className="overflow-hidden">
      <Head
        columns={["NAME", "EMAIL", "WORKSPACE", "ROLE", "JOINED", ""]}
        grid="lg:grid-cols-[1.1fr_1.3fr_1fr_110px_120px_110px]"
      />

      {shown.rows.map((user) => {
        // A workspace block reaches every account inside it, so the row has
        // to say why this one is shut out.
        const viaBusiness = Boolean(!user.blockedAt && user.business?.blockedAt)

        return (
          <Row
            key={user.id}
            grid="lg:grid-cols-[1.1fr_1.3fr_1fr_110px_120px_110px]"
            dim={Boolean(user.blockedAt) || viaBusiness}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 truncate text-sm font-semibold">
                {user.name}
                {user.superAdmin ? (
                  <span className="border-p-200 bg-p-100 text-p-700 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em] uppercase">
                    admin
                  </span>
                ) : null}
              </span>
              <span className="text-n-500 truncate text-xs">{user.phone}</span>
            </span>

            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[12.5px]">{user.email}</span>
              {user.blockedAt ? <BlockedChip /> : null}
              {viaBusiness ? <BlockedChip label="workspace" /> : null}
              {user.status === "removed" ? (
                <span className="text-n-500 border-n-300 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em] uppercase">
                  removed
                </span>
              ) : null}
            </span>

            <span className="text-n-600 truncate text-[12.5px]">
              {user.business?.name ?? "—"}
            </span>

            <span className="text-n-600 text-[12.5px] capitalize">
              {user.role}
            </span>

            <span className="text-n-600 text-[12.5px]">
              {formatDate(user.createdAt)}
            </span>

            <div className="lg:justify-self-end">
              {user.superAdmin ? (
                <span className="text-n-400 text-[12px]">—</span>
              ) : (
                <BlockButton
                  blocked={Boolean(user.blockedAt)}
                  onClick={() =>
                    onBlock({
                      kind: "user",
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      blocked: Boolean(user.blockedAt),
                    })
                  }
                />
              )}
            </div>
          </Row>
        )
      })}

      <Empty rows={rows.length} noun="account" />
      <Pagination
        page={shown.page}
        pageCount={shown.pageCount}
        from={shown.from}
        to={shown.to}
        total={rows.length}
        noun="users"
        onPage={onPage}
      />
    </Panel>
  )
}

function ProjectTable({
  rows,
  page,
  onPage,
}: {
  rows: AdminProject[]
  page: number
  onPage: (next: number) => void
}) {
  const shown = paginate(rows, page, PER_PAGE)

  return (
    <Panel className="overflow-hidden">
      <Head
        columns={["PROJECT", "WORKSPACE", "STATUS", "TASKS", "CREATED"]}
        grid="lg:grid-cols-[1.5fr_1.2fr_110px_90px_120px]"
      />

      {shown.rows.map((project) => (
        <Row
          key={project.id}
          grid="lg:grid-cols-[1.5fr_1.2fr_110px_90px_120px]"
          dim={project.status === "archived"}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">
              {project.name}
            </span>
            <span className="text-n-500 truncate text-xs">
              {project.site ?? "—"}
            </span>
          </span>

          <span className="text-n-600 truncate text-[12.5px]">
            {project.business?.name ?? "—"}
          </span>

          <span className="text-n-600 text-[12.5px] capitalize">
            {project.status}
          </span>

          <span className="text-n-700 font-mono text-[12.5px]">
            {project.tasks}
          </span>

          <span className="text-n-600 text-[12.5px]">
            {formatDate(project.createdAt)}
          </span>
        </Row>
      ))}

      <Empty rows={rows.length} noun="project" />
      <Pagination
        page={shown.page}
        pageCount={shown.pageCount}
        from={shown.from}
        to={shown.to}
        total={rows.length}
        noun="projects"
        onPage={onPage}
      />
    </Panel>
  )
}

function BlockDialog({
  target,
  open,
  onClose,
}: {
  target: Target
  open: boolean
  onClose: () => void
}) {
  const blockUser = useBlockUser(target.kind === "user" ? target.id : "")
  const blockBusiness = useBlockBusiness(
    target.kind === "business" ? target.id : ""
  )
  const mutation = target.kind === "user" ? blockUser : blockBusiness
  const next = !target.blocked

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[460px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {next ? "Block" : "Unblock"} {target.name}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {target.kind === "user" ? target.email : "Whole workspace"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          {target.kind === "business"
            ? next
              ? `Everyone in this workspace — all ${target.users}, owner included — is refused at sign-in and thrown out of any session still open. Nothing is deleted.`
              : "Everyone in this workspace can sign in again, unless they were blocked on their own account as well."
            : next
              ? "They are refused at sign-in and thrown out of any session still open. Their record and their work stay exactly as they are."
              : "They can sign in again, unless their whole workspace is blocked too."}
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
              mutation.mutate(next, {
                onSuccess: () => {
                  toast.success(
                    `${target.name} ${next ? "blocked" : "unblocked"}`
                  )
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className={cn(
              "rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60",
              next ? "bg-s-overdue" : "bg-p-500"
            )}
          >
            {mutation.isPending
              ? "Saving…"
              : next
                ? "Block"
                : "Unblock"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Head({ columns, grid }: { columns: string[]; grid: string }) {
  return (
    <div
      className={cn(
        "border-n-200 bg-n-100 hidden gap-3.5 border-b px-[18px] py-2.5 lg:grid",
        grid
      )}
    >
      {columns.map((head, index) => (
        <span
          key={`${head}${index}`}
          className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
        >
          {head}
        </span>
      ))}
    </div>
  )
}

function Row({
  grid,
  dim,
  children,
}: {
  grid: string
  dim?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:items-center",
        grid,
        dim && "opacity-60"
      )}
    >
      {children}
    </div>
  )
}

function Empty({ rows, noun }: { rows: number; noun: string }) {
  if (rows > 0) return null
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-n-500 m-0 text-sm">
        No {noun} matches that. Clear the search to see them all.
      </p>
    </div>
  )
}

function BlockedChip({ label = "blocked" }: { label?: string }) {
  return (
    <span className="text-s-overdue border-s-overdue/40 shrink-0 rounded-full border bg-[#fdecec] px-1.5 font-mono text-[10px] tracking-[0.05em] uppercase">
      {label}
    </span>
  )
}

function BlockButton({
  blocked,
  onClick,
}: {
  blocked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold",
        blocked
          ? "border-n-300 text-p-700 hover:bg-p-100"
          : "border-n-300 text-s-overdue hover:bg-[#fdecec]"
      )}
    >
      {blocked ? "Unblock" : "Block"}
    </button>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-n-400 size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

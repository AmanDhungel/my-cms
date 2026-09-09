"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"

import { InviteDialog } from "@/components/dashboard/people/invite-dialog"
import { MemberDialog } from "@/components/dashboard/people/member-dialog"
import { RemoveMemberDialog } from "@/components/dashboard/people/remove-member-dialog"
import { initialsOf } from "@/components/dashboard/viewer"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import type { InviteDTO } from "@/models/invite"
import type { UserDTO } from "@/models/user"

type Filter = "all" | "owner" | "supervisor" | "employee" | "removed"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "owner", label: "Owners" },
  { value: "supervisor", label: "Supervisors" },
  { value: "employee", label: "Employees" },
  { value: "removed", label: "Removed" },
]

export function PeopleView({
  canManage,
  viewerId,
  ownerId,
  members,
  invites,
}: {
  canManage: boolean
  viewerId: string
  ownerId: string
  members: UserDTO[]
  invites: InviteDTO[]
}) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<Filter>("all")
  const [query, setQuery] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserDTO | null>(null)
  const [removing, setRemoving] = React.useState<UserDTO | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = members.filter((member) => {
    if (filter === "removed") {
      if (member.status !== "removed") return false
    } else {
      // Removed people only show under their own filter, so the crew list
      // reads as who is actually here.
      if (member.status === "removed") return false
      if (filter !== "all" && member.role !== filter) return false
    }
    if (!needle) return true
    return (
      member.name.toLowerCase().includes(needle) ||
      member.email.toLowerCase().includes(needle) ||
      member.phone.toLowerCase().includes(needle)
    )
  })

  const active = members.filter((m) => m.status === "active")
  const counts = {
    active: active.length,
    removed: members.length - active.length,
    supervisors: active.filter((m) => m.role === "supervisor").length,
    employees: active.filter((m) => m.role === "employee").length,
  }

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="People"
        subtitle={`${counts.employees} employee${counts.employees === 1 ? "" : "s"} · ${counts.supervisors} supervisor${
          counts.supervisors === 1 ? "" : "s"
        } · ${invites.length} invite${invites.length === 1 ? "" : "s"} pending`}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="bg-a-400 text-a-900 flex items-center gap-[7px] rounded-md px-[15px] py-2.5 text-sm font-semibold shadow-[0_3px_10px_rgba(200,127,15,0.22)] transition-[filter] hover:brightness-[1.06]"
            >
              <PlusIcon className="size-3.5" />
              Invite employee
            </button>
          ) : null
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ACTIVE MEMBERS" value={counts.active} />
        <StatCard label="SUPERVISORS" value={counts.supervisors} />
        <StatCard label="EMPLOYEES" value={counts.employees} />
        <StatCard
          label="INVITES PENDING"
          value={invites.length}
          accent={invites.length > 0}
        />
      </div>

      <Panel className="overflow-hidden">
        <div className="border-n-200 flex flex-wrap items-center justify-between gap-4 border-b px-[18px] py-3.5">
          <div className="flex flex-wrap gap-1.5">
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

          <label className="border-n-200 bg-n-50 flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
            />
          </label>
        </div>

        <div className="border-n-200 bg-n-100 hidden grid-cols-[1.4fr_150px_130px_100px_130px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
          {["NAME / ROLE", "EMAIL", "PHONE", "SHIFT", ""].map((head) => (
            <span
              key={head}
              className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
            >
              {head}
            </span>
          ))}
        </div>

        {visible.map((member) => (
          <div
            key={member.id}
            className={cn(
              "border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.4fr_150px_130px_100px_130px] lg:items-center",
              member.status === "removed" && "opacity-55"
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="font-heading bg-p-100 text-p-700 flex size-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
              >
                {initialsOf(member.name)}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {member.name}
                  {member.id === viewerId ? (
                    <span className="text-n-400 ml-1.5 font-mono text-[10.5px]">
                      YOU
                    </span>
                  ) : null}
                </span>
                <span className="text-n-500 flex items-center gap-1.5 text-xs capitalize">
                  {member.role}
                  {member.status === "removed" ? (
                    <span className="text-s-overdue border-s-overdue/40 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em] uppercase">
                      removed
                    </span>
                  ) : null}
                </span>
              </span>
            </div>
            <span className="text-n-700 truncate text-[12.5px]">
              {member.email}
            </span>
            <span className="text-n-700 font-mono text-[12.5px]">
              {member.phone}
            </span>
            <span className="text-n-600 text-[12.5px]">
              {member.shift ?? "—"}
            </span>

            {canManage && member.status === "active" ? (
              <div className="flex gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(member)}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Edit
                </button>
                {member.id === viewerId || member.id === ownerId ? null : (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    className="border-n-300 text-s-overdue hover:bg-[#fdecec] rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <span />
            )}
          </div>
        ))}

        {visible.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-n-500 m-0 text-sm">
              Nobody matches that. Clear the search or pick another filter.
            </p>
          </div>
        ) : null}

        <div className="text-n-500 px-[18px] py-3 text-[13px]">
          Showing {visible.length} of {counts.active}
          {counts.removed > 0 ? ` · ${counts.removed} removed` : ""}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-n-200 flex items-center justify-between gap-4 border-b px-[18px] py-4">
          <h2 className="font-heading m-0 text-base font-semibold">
            Pending invites
          </h2>
          <span className="text-n-500 font-mono text-[11px]">
            {invites.length}
          </span>
        </div>

        {invites.length === 0 ? (
          <div className="p-[18px]">
            <EmptyState
              message="No invites outstanding. Every account in this workspace was created through one — there is no open sign-up."
              action={
                canManage ? (
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className={primaryButtonClass}
                  >
                    Invite someone
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="border-n-200/70 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{invite.name}</span>
                <span className="text-n-500 text-[12.5px]">
                  {invite.email} · {invite.role} · {invite.shift}
                </span>
              </div>
              <span className="text-a-700 bg-a-50 rounded px-2 py-1 font-mono text-[10.5px]">
                EXPIRES {new Date(invite.expiresAt).toLocaleDateString("en-GB")}
              </span>
            </div>
          ))
        )}
      </Panel>

      {editing ? (
        <MemberDialog
          key={editing.id}
          member={editing}
          isWorkspaceOwner={editing.id === ownerId}
          open
          onClose={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      ) : null}

      {removing ? (
        <RemoveMemberDialog
          key={removing.id}
          member={removing}
          open
          onClose={() => {
            setRemoving(null)
            router.refresh()
          }}
        />
      ) : null}

      {canManage ? (
        <InviteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSent={() => {
            toast.success("Invite created. Copy the link and send it over.")
            router.refresh()
          }}
        />
      ) : null}
    </DashboardMain>
  )
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

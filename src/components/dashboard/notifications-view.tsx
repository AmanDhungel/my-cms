"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { CardsSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import {
  reportMutationError,
  useMarkRead,
  useNotifications,
} from "@/lib/queries"
import type { NotificationKind } from "@/lib/work-constants"
import type { NotificationDTO } from "@/models/notification"

const DOT: Record<NotificationKind, string> = {
  check_in: "bg-s-done",
  check_out: "bg-s-pending",
  task_blocked: "bg-s-material",
  task_in_review: "bg-s-time",
  task_done: "bg-s-done",
  task_assigned: "bg-s-progress",
  request_raised: "bg-a-400",
  request_decided: "bg-s-time",
  member_joined: "bg-p-500",
}

/**
 * A real feed: every row was written when something actually happened —
 * a check-in, a block, a decision — rather than being derived at read time.
 */
export function NotificationsView({ timeZone }: { timeZone: string }) {
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const query = useNotifications(unreadOnly)
  const markRead = useMarkRead()

  const entries = query.data?.notifications ?? []
  const unread = query.data?.unread ?? 0
  const groups = groupByDay(entries, timeZone)

  return (
    <DashboardMain className="max-w-[900px] gap-5">
      <PageHeading
        eyebrow="Account"
        title="Notifications"
        subtitle="Check-ins, blocked work and decisions, as they happen."
        actions={
          <button
            type="button"
            onClick={() =>
              markRead.mutate(undefined, {
                onError: (error) => reportMutationError(error),
              })
            }
            disabled={unread === 0 || markRead.isPending}
            className={secondaryButtonClass}
          >
            {markRead.isPending ? "Marking…" : `Mark all read${unread ? ` (${unread})` : ""}`}
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { value: false, label: "Everything" },
          { value: true, label: `Unread${unread ? ` · ${unread}` : ""}` },
        ].map((chip) => (
          <button
            key={String(chip.value)}
            type="button"
            onClick={() => setUnreadOnly(chip.value)}
            aria-pressed={unreadOnly === chip.value}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
              unreadOnly === chip.value
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
          message="Couldn't load notifications. Your connection may have dropped."
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
      ) : entries.length === 0 ? (
        <EmptyState
          message={
            unreadOnly
              ? "Nothing unread."
              : "Nothing yet. Check-ins, blocked tasks and decisions all land here."
          }
        />
      ) : (
        groups.map(([label, rows]) => (
          <div key={label} className="flex flex-col gap-2.5">
            <span className="text-n-400 font-mono text-[10.5px] tracking-[0.08em] uppercase">
              {label}
            </span>
            <Panel className="overflow-hidden">
              {rows.map((entry) => (
                <Row
                  key={entry.id}
                  entry={entry}
                  timeZone={timeZone}
                  onRead={() =>
                    markRead.mutate(entry.id, {
                      onError: (error) => reportMutationError(error),
                    })
                  }
                />
              ))}
            </Panel>
          </div>
        ))
      )}
    </DashboardMain>
  )
}

function Row({
  entry,
  timeZone,
  onRead,
}: {
  entry: NotificationDTO
  timeZone: string
  onRead: () => void
}) {
  const unread = !entry.readAt

  const inner = (
    <>
      <span
        aria-hidden
        className={cn("mt-[7px] size-2 shrink-0 rounded-full", DOT[entry.kind])}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-[14px]",
            unread ? "font-semibold" : "text-n-700 font-medium"
          )}
        >
          {entry.title}
        </span>
        {entry.body ? (
          <span className="text-n-500 text-[12.5px] leading-relaxed">
            {entry.body}
          </span>
        ) : null}
      </span>
      <span className="text-n-400 shrink-0 font-mono text-[11px]">
        {clock(entry.createdAt, timeZone)}
      </span>
    </>
  )

  const className = cn(
    "border-n-200/70 flex items-start gap-3 border-b px-[18px] py-3.5 text-left last:border-b-0",
    unread ? "bg-p-50/40" : "bg-white",
    "hover:bg-n-50 transition-colors"
  )

  if (entry.href) {
    return (
      <Link href={entry.href} onClick={onRead} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onRead} className={className}>
      {inner}
    </button>
  )
}

/** Today / Yesterday / a date, matching how the design groups the feed. */
function groupByDay(entries: NotificationDTO[], timeZone: string) {
  const today = dayKey(new Date().toISOString(), timeZone)
  const yesterday = dayKey(
    new Date(Date.now() - 86_400_000).toISOString(),
    timeZone
  )

  const buckets = new Map<string, NotificationDTO[]>()
  for (const entry of entries) {
    const key = dayKey(entry.createdAt, timeZone)
    const label =
      key === today ? "Today" : key === yesterday ? "Yesterday" : longDate(key)
    const bucket = buckets.get(label) ?? []
    bucket.push(entry)
    buckets.set(label, bucket)
  }

  return [...buckets.entries()]
}

function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

function longDate(key: string) {
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

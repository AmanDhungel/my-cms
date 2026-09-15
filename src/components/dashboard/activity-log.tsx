"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { DayStepper } from "@/components/dashboard/attendance/day-stepper"
import { CardsSkeleton } from "@/components/dashboard/skeletons"
import {
  EmptyState,
  Panel,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  ACTION_TONE,
  ACTION_VERBS,
  SUBJECTLESS,
} from "@/lib/activity-labels"
import { useActivity } from "@/lib/queries"
import type { ActivityDTO } from "@/models/activity"

/**
 * One day of the workspace, in the order it happened. Unlike the feed beside
 * it, nothing here is addressed to anybody — the owner's own actions are in
 * it too, which is what makes it answer "who moved that".
 */
export function ActivityLog({ timeZone }: { timeZone: string }) {
  const [day, setDay] = React.useState<string | undefined>(undefined)
  const [who, setWho] = React.useState<string | null>(null)

  const query = useActivity(day)

  const entries = React.useMemo(
    () => query.data?.entries ?? [],
    [query.data?.entries]
  )
  const shownDay = query.data?.day ?? day ?? ""
  const today = query.data?.today ?? ""
  const zone = query.data?.timeZone ?? timeZone

  // Built from the whole day, so picking a person doesn't empty the filter
  // that got you there.
  const people = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const entry of entries) seen.set(entry.actorId, entry.actorName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const visible = who
    ? entries.filter((entry) => entry.actorId === who)
    : entries

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-n-500 text-[13px]">
          {query.isPending
            ? "Reading the day…"
            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · ${query.data?.summary.people ?? 0} ${
                query.data?.summary.people === 1 ? "person" : "people"
              }`}
        </span>
        {shownDay ? (
          <DayStepper day={shownDay} today={today} onChange={setDay} />
        ) : null}
      </div>

      {people.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Chip active={who === null} onClick={() => setWho(null)}>
            Everyone
          </Chip>
          {people.map(([id, name]) => (
            <Chip key={id} active={who === id} onClick={() => setWho(id)}>
              {name}
            </Chip>
          ))}
        </div>
      ) : null}

      {query.isPending ? (
        <CardsSkeleton cards={3} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the log. Your connection may have dropped."
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
            who
              ? "Nothing from them on this day."
              : "Nothing happened on this day. Status changes, shifts, check-ins and decisions all land here."
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          {visible.map((entry) => (
            <Row key={entry.id} entry={entry} timeZone={zone} />
          ))}
        </Panel>
      )}
    </div>
  )
}

function Row({ entry, timeZone }: { entry: ActivityDTO; timeZone: string }) {
  const inner = (
    <>
      <span className="text-n-400 w-[42px] shrink-0 pt-[3px] font-mono text-[11.5px]">
        {clock(entry.at, timeZone)}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-[7px] size-2 shrink-0 rounded-full",
          ACTION_TONE[entry.action]
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] leading-[1.5]">
          <span className="font-semibold">{entry.actorName}</span>{" "}
          <span className="text-n-600">{ACTION_VERBS[entry.action]}</span>
          {SUBJECTLESS.includes(entry.action) ? null : (
            <>
              {" "}
              <span className="font-medium">{entry.subject}</span>
            </>
          )}
          {entry.from && entry.to ? (
            <>
              {" "}
              <span className="text-n-500 font-mono text-[11.5px] uppercase">
                {entry.from} → {entry.to}
              </span>
            </>
          ) : null}
        </span>
        {entry.detail ? (
          <span className="text-n-500 text-[12.5px] leading-relaxed">
            {entry.detail}
          </span>
        ) : null}
      </span>
    </>
  )

  const className =
    "border-n-200/70 flex items-start gap-2.5 border-b bg-white px-[18px] py-3 last:border-b-0 hover:bg-n-50 transition-colors"

  return entry.href ? (
    <Link href={entry.href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {children}
    </button>
  )
}

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}

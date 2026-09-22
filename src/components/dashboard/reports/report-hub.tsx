"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import {
  DateRangeFilter,
  type DateRange,
} from "@/components/dashboard/date-range-filter"
import { ReportChart } from "@/components/dashboard/reports/report-chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  GROUP_COPY,
  reportHref,
  reportsIn,
  type ReportGroup,
} from "@/lib/reports"
import { useReportGroup, type GroupReportCard } from "@/lib/queries"

/**
 * One category, as a board of its own charts.
 *
 * The sidebar lists four groups rather than twenty-five links — a nav you
 * have to scroll is a nav nobody reads — so this is both the index of the
 * group and the first look at what it says. Every card opens the full report.
 */
export function ReportHub({ group }: { group: ReportGroup }) {
  const [range, setRange] = React.useState<DateRange | undefined>(undefined)

  const copy = GROUP_COPY[group]
  const defs = reportsIn(group)

  const query = useReportGroup(group, {
    from: range?.from ? isoDay(range.from) : undefined,
    to: range?.to ? isoDay(range.to) : undefined,
  })

  const cards = query.data?.reports ?? []
  const byslug = new Map(cards.map((one) => [one.slug, one]))

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Reports & analytics"
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <div className="border-n-200 flex items-center gap-2 rounded-[10px] border bg-white p-1.5">
            <DateRangeFilter value={range} onChange={setRange} />
            {range ? (
              <button
                type="button"
                onClick={() => setRange(undefined)}
                className="text-n-500 hover:text-n-800 px-1.5 text-[12.5px] font-semibold"
              >
                Clear
              </button>
            ) : null}
          </div>
        }
      />

      <p className="text-n-500 m-0 text-[13px]">
        The window above applies to every card here. Open a report for its own
        filters, the full table and the export.
      </p>

      {query.isError ? (
        <EmptyState
          message="Couldn't load these reports. Your connection may have dropped."
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
      ) : (
        <div className="grid gap-3.5 xl:grid-cols-2">
          {defs.map((def) => (
            <Card
              key={def.slug}
              slug={def.slug}
              title={def.title}
              subtitle={def.subtitle}
              status={def.status}
              missing={def.missing}
              card={byslug.get(def.slug)}
              loading={query.isPending}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(GROUP_COPY) as ReportGroup[])
          .filter((one) => one !== group)
          .map((one) => (
            <Link
              key={one}
              href={GROUP_COPY[one].href}
              className="border-n-200 text-n-600 hover:bg-n-100 rounded-full border bg-white px-3 py-1.5 text-[12.5px] font-medium"
            >
              {GROUP_COPY[one].title} →
            </Link>
          ))}
      </div>
    </DashboardMain>
  )
}

function Card({
  slug,
  title,
  subtitle,
  status,
  missing,
  card,
  loading,
}: {
  slug: string
  title: string
  subtitle: string
  status: "ready" | "partial" | "blocked"
  missing?: string
  card?: GroupReportCard
  loading: boolean
}) {
  const blocked = status === "blocked"

  return (
    <Panel
      className={cn(
        "flex flex-col gap-3 p-[18px]",
        blocked && "bg-n-100/50 border-dashed"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={reportHref(slug)}
            className="font-heading hover:text-p-600 text-[15.5px] font-semibold"
          >
            {title}
          </Link>
          <span className="text-n-500 text-[12.5px]">{subtitle}</span>
        </div>
        {status === "ready" ? null : (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-[0.06em]",
              blocked
                ? "border-n-300 text-n-500 bg-white"
                : "border-a-200 bg-a-50 text-a-700"
            )}
          >
            {blocked ? "NO DATA YET" : "PARTIAL"}
          </span>
        )}
      </div>

      {card?.stats?.length ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {card.stats.map((stat) => (
            <span key={stat.label} className="flex flex-col">
              <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                {stat.label}
              </span>
              <span
                className={cn(
                  "font-heading text-[17px] font-semibold",
                  stat.accent && "text-a-700"
                )}
              >
                {stat.value}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {blocked ? (
        <p className="text-n-600 m-0 text-[12.5px] leading-relaxed">
          {missing}
        </p>
      ) : loading ? (
        <Skeleton className="h-[150px] w-full rounded-[10px]" />
      ) : card?.chart ? (
        // Five bars on a card; the report itself carries the full ranking.
        <ReportChart chart={card.chart} limit={5} />
      ) : (
        <p className="text-n-500 m-0 py-4 text-[12.5px]">
          {card && card.rows > 0
            ? "Not enough here to be worth a chart yet — the figures are in the report."
            : "Nothing in this window."}
        </p>
      )}

      <Link
        href={reportHref(slug)}
        className="text-p-600 hover:text-p-700 mt-auto w-fit pt-1 text-[12.5px] font-semibold"
      >
        Open {title.toLowerCase()} →
      </Link>
    </Panel>
  )
}

/** The viewer's own calendar day, not UTC — the filter reads in local days. */
function isoDay(at: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

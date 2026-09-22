"use client"

import Link from "next/link"
import { cn } from "cn"

import { ReportChart } from "@/components/dashboard/reports/report-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Panel } from "@/components/dashboard/ui"
import { reportHref } from "@/lib/reports"
import { useReportGroup, type GroupReportCard } from "@/lib/queries"

/**
 * The four charts the dashboard leads with, one from each family: what came
 * in, what is owed, what is running out, and who turned up.
 *
 * They are read from the same group endpoints the hubs use, so the dashboard
 * can never show a different number from the report it links to.
 */
const HEADLINES: { group: string; slug: string; heading: string }[] = [
  { group: "finance", slug: "cash-flow", heading: "Money in and out" },
  { group: "finance", slug: "receivables", heading: "What you are owed" },
  { group: "inventory", slug: "low-stock", heading: "Running out" },
  { group: "sales", slug: "sales-by-product", heading: "What is selling" },
]

export function DashboardCharts() {
  // Three groups rather than four requests: two headlines share finance.
  const finance = useReportGroup("finance", {})
  const inventory = useReportGroup("inventory", {})
  const sales = useReportGroup("sales", {})

  const byGroup: Record<string, ReturnType<typeof useReportGroup>> = {
    finance,
    inventory,
    sales,
  }

  const loading = finance.isPending || inventory.isPending || sales.isPending

  const cards = HEADLINES.map((headline) => ({
    ...headline,
    card: byGroup[headline.group].data?.reports.find(
      (one) => one.slug === headline.slug
    ),
  }))

  // Nothing worth drawing yet — a young workspace shouldn't get four empty
  // boxes on its front page.
  if (!loading && cards.every((one) => !one.card?.chart)) return null

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading m-0 text-base font-semibold">
          At a glance
        </h2>
        <Link
          href="/dashboard/reports/sales"
          className="text-p-600 text-[13.5px] font-semibold"
        >
          All reports →
        </Link>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-2">
        {cards.map((one) => (
          <HeadlineCard
            key={one.slug}
            heading={one.heading}
            slug={one.slug}
            card={one.card}
            loading={loading}
          />
        ))}
      </div>
    </div>
  )
}

function HeadlineCard({
  heading,
  slug,
  card,
  loading,
}: {
  heading: string
  slug: string
  card?: GroupReportCard
  loading: boolean
}) {
  // A card with nothing to draw is left out rather than shown empty.
  if (!loading && !card?.chart) return null

  return (
    <Panel className="flex flex-col gap-3 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={reportHref(slug)}
          className="font-heading hover:text-p-600 text-[15px] font-semibold"
        >
          {heading}
        </Link>
        {card?.stats?.length ? (
          <span className="flex flex-wrap gap-x-4">
            {card.stats.map((stat) => (
              <span key={stat.label} className="flex items-baseline gap-1.5">
                <span className="text-n-500 font-mono text-[10px] tracking-[0.06em]">
                  {stat.label}
                </span>
                <span
                  className={cn(
                    "text-[13.5px] font-semibold",
                    stat.accent && "text-a-700"
                  )}
                >
                  {stat.value}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-[150px] w-full rounded-[10px]" />
      ) : card?.chart ? (
        <ReportChart chart={card.chart} limit={5} />
      ) : null}

      <Link
        href={reportHref(slug)}
        className="text-p-600 hover:text-p-700 mt-auto w-fit text-[12.5px] font-semibold"
      >
        Open the report →
      </Link>
    </Panel>
  )
}

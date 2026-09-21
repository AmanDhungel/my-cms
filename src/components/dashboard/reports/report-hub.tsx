"use client"

import Link from "next/link"
import { cn } from "cn"

import {
  DashboardMain,
  PageHeading,
  Panel,
} from "@/components/dashboard/ui"
import {
  GROUP_COPY,
  reportHref,
  reportsIn,
  type ReportGroup,
} from "@/lib/reports"

/**
 * One category's reports, as cards. The sidebar lists four groups rather than
 * twenty-five links — a nav you have to scroll is a nav nobody reads — so this
 * is where the full list actually lives.
 */
export function ReportHub({ group }: { group: ReportGroup }) {
  const copy = GROUP_COPY[group]
  const reports = reportsIn(group)

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Reports & analytics"
        title={copy.title}
        subtitle={copy.subtitle}
      />

      <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.slug} href={reportHref(report.slug)}>
            <Panel
              className={cn(
                "hover:border-p-400 flex h-full flex-col gap-2 p-[18px] transition-colors",
                report.status === "blocked" && "bg-n-100/50 border-dashed"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-heading text-[15.5px] font-semibold">
                  {report.title}
                </span>
                {report.status === "ready" ? null : (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-[0.06em]",
                      report.status === "blocked"
                        ? "border-n-300 text-n-500 bg-white"
                        : "border-a-200 bg-a-50 text-a-700"
                    )}
                  >
                    {report.status === "blocked" ? "NO DATA YET" : "PARTIAL"}
                  </span>
                )}
              </div>

              <p className="text-n-600 m-0 text-[13px] leading-relaxed">
                {report.subtitle}
              </p>

              <span className="text-p-600 mt-auto pt-1 text-[12.5px] font-semibold">
                Open →
              </span>
            </Panel>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(GROUP_COPY) as ReportGroup[])
          .filter((one) => one !== group)
          .map((one) => (
            <Link
              key={one}
              href={GROUP_COPY[one].href}
              className="border-n-200 text-n-600 hover:bg-n-100 rounded-full border bg-white px-3 py-1.5 text-[12.5px] font-medium"
            >
              {GROUP_COPY[one].title}
            </Link>
          ))}
      </div>
    </DashboardMain>
  )
}

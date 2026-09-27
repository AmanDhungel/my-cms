import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ReportView } from "@/components/dashboard/reports/report-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { canReadReportGroup, REPORT_BY_SLUG } from "@/lib/reports"

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/reports/[report]">): Promise<Metadata> {
  const { report } = await params
  const def = REPORT_BY_SLUG.get(report)
  return { title: def ? `${def.title} · EMS` : "Report · EMS" }
}

export default async function ReportPage({
  params,
}: PageProps<"/dashboard/reports/[report]">) {
  const viewer = await requirePageRole("owner", "supervisor")
  const { report } = await params

  const def = REPORT_BY_SLUG.get(report)
  if (!def) notFound()
  if (!canReadReportGroup(def.group, viewer.role)) redirect("/dashboard")

  return <ReportView report={def} />
}

import type { Metadata } from "next"

import { ReportHub } from "@/components/dashboard/reports/report-hub"
import { requirePageRole } from "@/lib/auth/page-guards"
import { GROUP_COPY } from "@/lib/reports"

export const metadata: Metadata = { title: `${GROUP_COPY.finance.title} · EMS` }

export default async function Page() {
  await requirePageRole("owner", "supervisor")
  return <ReportHub group="finance" />
}

import type { Metadata } from "next"

import { ReportHub } from "@/components/dashboard/reports/report-hub"
import { requirePageRole } from "@/lib/auth/page-guards"
import { GROUP_COPY } from "@/lib/reports"

export const metadata: Metadata = { title: `${GROUP_COPY.finance.title} · EMS` }

export default async function Page() {
  // Payments and accounts are the owner's alone (lib/reports.ts).
  await requirePageRole("owner")
  return <ReportHub group="finance" />
}

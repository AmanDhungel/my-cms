import type { Metadata } from "next"

import {
  DashboardMain,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/ui"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Approvals · EMS" }

export default async function ApprovalsPage() {
  await requirePageRole("owner", "supervisor")

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Approvals"
        subtitle="Leave, advance and material requests the crew sends you."
      />
      <EmptyState message="Nothing waiting on you. Requests will queue here once the crew app can raise them." />
    </DashboardMain>
  )
}

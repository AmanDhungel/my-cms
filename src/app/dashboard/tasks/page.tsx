import type { Metadata } from "next"

import {
  DashboardMain,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/ui"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "All tasks · EMS" }

export default async function TasksPage() {
  await requirePageRole("owner", "supervisor")

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="All tasks"
        subtitle="Every located task across the workspace, with its check-in state."
      />
      <EmptyState message="No tasks yet. A task carries a site, a time window and a geofence radius — none of that has a store behind it yet." />
    </DashboardMain>
  )
}

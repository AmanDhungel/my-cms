import type { Metadata } from "next"

import {
  DashboardMain,
  EmptyState,
  PageHeading,
} from "@/components/dashboard/ui"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Projects · EMS" }

export default async function ProjectsPage() {
  await requirePageRole("owner", "supervisor")

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Projects"
        subtitle="A project groups located tasks under one site and one crew."
      />
      <EmptyState message="No projects yet. Projects need their own model and API before this page can create one — the auth and invite layer is what's live today." />
    </DashboardMain>
  )
}

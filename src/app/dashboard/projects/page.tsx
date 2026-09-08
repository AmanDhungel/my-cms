import type { Metadata } from "next"

import { ProjectsView } from "@/components/dashboard/projects/projects-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Projects · EMS" }

export default async function ProjectsPage() {
  await requirePageRole("owner", "supervisor")
  return <ProjectsView canManage />
}

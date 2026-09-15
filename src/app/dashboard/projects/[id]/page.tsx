import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Types } from "mongoose"

import { ProjectDetailView } from "@/components/dashboard/projects/project-detail-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { getWorkspace } from "@/lib/workspace"
import { Project, toProjectDTO } from "@/models/project"

export const metadata: Metadata = { title: "Project · EMS" }

export default async function ProjectPage({
  params,
}: PageProps<"/dashboard/projects/[id]">) {
  const viewer = await requirePageRole("owner", "supervisor")
  const { id } = await params

  // A hand-typed URL shouldn't reach mongoose and come back a 500.
  if (!Types.ObjectId.isValid(id)) notFound()

  await connectToDatabase()

  // Scoped to the workspace, so a guessed id can't reach another org's job.
  const [project, business] = await Promise.all([
    Project.findOne({ _id: id, business: viewer.businessId }),
    getWorkspace(viewer.businessId),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailView
      project={toProjectDTO(project)}
      canAssign={viewer.role === "owner" || viewer.role === "supervisor"}
      timeZone={business.timeZone}
    />
  )
}

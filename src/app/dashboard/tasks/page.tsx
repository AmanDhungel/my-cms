import type { Metadata } from "next"

import { TasksView } from "@/components/dashboard/tasks/tasks-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { getWorkspace } from "@/lib/workspace"

export const metadata: Metadata = { title: "All tasks · EMS" }

export default async function TasksPage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await getWorkspace(viewer.businessId)

  return <TasksView canAssign timeZone={business.timeZone} />
}

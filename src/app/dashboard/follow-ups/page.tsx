import type { Metadata } from "next"

import { OperationsView } from "@/components/dashboard/operations/operations-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Follow-ups · EMS" }

export default async function Page() {
  await requirePageRole("owner", "supervisor")
  return <OperationsView kind="follow_up" />
}

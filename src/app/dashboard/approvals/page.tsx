import type { Metadata } from "next"

import { ApprovalsView } from "@/components/dashboard/approvals/approvals-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Approvals · EMS" }

export default async function ApprovalsPage() {
  const viewer = await requirePageRole("owner", "supervisor")
  return <ApprovalsView canDecide={viewer.role === "owner"} />
}

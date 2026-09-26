import type { Metadata } from "next"

import { MyTicketsView } from "@/components/dashboard/employee/my-tickets-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "My tickets · EMS" }

export default async function MyTicketsPage() {
  await requirePageRole("employee")
  return <MyTicketsView />
}

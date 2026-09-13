import type { Metadata } from "next"

import { CustomersView } from "@/components/dashboard/customers/customers-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Customers · EMS" }

export default async function CustomersPage() {
  // Whoever can raise a bill can keep the customer list behind it.
  await requirePageRole("owner", "supervisor")
  return <CustomersView />
}

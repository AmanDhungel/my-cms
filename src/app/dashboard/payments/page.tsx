import type { Metadata } from "next"

import { PaymentsView } from "@/components/dashboard/payments/payments-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Payments · EMS" }

export default async function PaymentsPage() {
  // Owner only: a supervisor runs the stock and the bills, but doesn't see
  // what the business pays out.
  const viewer = await requirePageRole("owner")

  await connectToDatabase()
  const business = await Business.findById(viewer.businessId).orFail()

  // The date field starts on the workspace's calendar, not the browser's.
  return <PaymentsView today={dayKeyInZone(new Date(), business.timeZone)} />
}

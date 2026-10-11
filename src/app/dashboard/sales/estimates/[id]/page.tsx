import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Types } from "mongoose"

import { EstimateView } from "@/components/dashboard/sales/estimates/estimate-view"
import { rememberedWorkspace } from "@/lib/auth/membership"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Business } from "@/models/business"

export const metadata: Metadata = { title: "Estimate · EMS" }

/** One estimate, reached from the Estimates tab on Sales. */
export default async function EstimatePage({
  params,
}: PageProps<"/dashboard/sales/estimates/[id]">) {
  const viewer = await requirePageRole("owner", "supervisor")
  const { id } = await params
  if (!Types.ObjectId.isValid(id)) notFound()

  await connectToDatabase()
  const business = await (rememberedWorkspace(viewer) ?? Business.findById(viewer.businessId).orFail())

  return (
    <EstimateView
      id={id}
      businessName={business.name}
      vatRate={business.vatRate}
      today={dayKeyInZone(new Date(), business.timeZone)}
    />
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Types } from "mongoose"

import { BillView } from "@/components/dashboard/sales/bill-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Bill, toBillDTO } from "@/models/bill"
import { Business } from "@/models/business"
import { User } from "@/models/user"

export const metadata: Metadata = { title: "Bill · EMS" }

export default async function BillPage({
  params,
}: PageProps<"/dashboard/sales/[id]">) {
  const viewer = await requirePageRole("owner", "supervisor")
  const { id } = await params

  // A hand-typed URL shouldn't reach mongoose and come back a 500.
  if (!Types.ObjectId.isValid(id)) notFound()

  await connectToDatabase()

  const bill = await Bill.findOne({ _id: id, business: viewer.businessId })
  if (!bill) notFound()

  const [business, issuer] = await Promise.all([
    Business.findById(viewer.businessId).orFail(),
    User.findById(bill.issuedBy).select("name"),
  ])

  return (
    <BillView
      bill={toBillDTO(bill)}
      business={{ name: business.name, pan: business.pan ?? null }}
      issuedBy={issuer?.name ?? null}
    />
  )
}

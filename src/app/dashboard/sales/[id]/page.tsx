import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Types } from "mongoose"

import { BillView } from "@/components/dashboard/sales/bill-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { Bill, toBillDTO } from "@/models/bill"
import { Payment } from "@/models/payment"
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

  const [business, issuer, received] = await Promise.all([
    Business.findById(viewer.businessId).orFail(),
    User.findById(bill.issuedBy).select("name"),
    // The instalments against it, oldest first, so the bill can show what is
    // still owed rather than just whether someone ticked "paid".
    Payment.find({ bill: bill._id, direction: "in" }).sort({ paidOn: 1 }),
  ])

  const paid = received.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <BillView
      bill={toBillDTO(bill, paid)}
      payments={received.map((payment) => ({
        id: String(payment._id),
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference ?? null,
        paidOn: dayKeyInZone(payment.paidOn, business.timeZone),
      }))}
      business={{ name: business.name, pan: business.pan ?? null }}
      issuedBy={issuer?.name ?? null}
    />
  )
}

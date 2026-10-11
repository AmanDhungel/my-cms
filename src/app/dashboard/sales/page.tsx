import type { Metadata } from "next"
import { Types } from "mongoose"

import type { BillPrefill } from "@/components/dashboard/sales/bill-dialog"
import { SalesView } from "@/components/dashboard/sales/sales-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { canDo, estimateState, type EstimateStatus } from "@/lib/estimates"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { rememberedWorkspace } from "@/lib/auth/membership"
import { Business } from "@/models/business"
import { Estimate } from "@/models/estimate"
import { InventoryItem } from "@/models/inventory-item"

export const metadata: Metadata = { title: "Sales · EMS" }

export default async function SalesPage({ searchParams }: PageProps<"/dashboard/sales">) {
  // Owners and supervisors only, the same as Inventory beside it.
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()
  const business = await (rememberedWorkspace(viewer) ?? Business.findById(viewer.businessId).orFail())
  const today = dayKeyInZone(new Date(), business.timeZone)
  const params = await searchParams
  const tab = params.tab === "estimates" || params.tab === "expenses" ? params.tab : undefined

  /*
   * "Convert to sale": the bill form is filled in here, on the server, from
   * the saved estimate — never from anything the browser sent. A stock line
   * is priced from the inventory, as every sale is; the sale itself, when
   * saved, checks the estimate again (atomically) before flipping it.
   */
  let prefill: BillPrefill | undefined
  let prefillError: string | undefined
  const fromEstimate = typeof params.fromEstimate === "string" ? params.fromEstimate : null
  if (fromEstimate && Types.ObjectId.isValid(fromEstimate)) {
    const estimate = await Estimate.findOne({ _id: fromEstimate, business: viewer.businessId })
    const state = estimate
      ? estimateState(
          estimate.status as EstimateStatus,
          dayKeyInZone(estimate.validUntil, business.timeZone),
          today
        )
      : null
    if (!estimate || !state) prefillError = "That estimate doesn't exist."
    else if (!canDo(state, "convert")) {
      prefillError =
        state === "converted"
          ? `${estimate.number} is already a sale.`
          : `${estimate.number} is ${state}. Reopen it before converting.`
    } else {
      const ids = estimate.lines.flatMap((line) => (line.item ? [line.item] : []))
      const items = ids.length
        ? await InventoryItem.find({ _id: { $in: ids }, business: viewer.businessId }).select("price")
        : []
      const priceOf = new Map(items.map((item) => [String(item._id), item.price]))
      prefill = {
        estimateId: String(estimate._id),
        estimateNumber: estimate.number,
        source: estimate.source as BillPrefill["source"],
        customerId: estimate.customerRef ? String(estimate.customerRef) : null,
        customer: {
          name: estimate.customer.name,
          phone: estimate.customer.phone ?? "",
          email: estimate.customer.email ?? "",
          address: estimate.customer.address ?? "",
          pan: estimate.customer.pan ?? "",
        },
        lines: estimate.lines.map((line) => ({
          itemId: line.item ? String(line.item) : null,
          name: line.name,
          unit: line.unit,
          price: line.item ? (priceOf.get(String(line.item)) ?? line.price) : line.price,
          qty: line.qty,
          discountPct: line.discountPct,
        })),
        withVat: estimate.vatRate > 0,
        note: estimate.note ?? "",
      }
    }
  }

  return (
    <SalesView
      // The dialog needs the saved rate to label its VAT switch.
      vatRate={business.vatRate}
      // The expense side of the page is the owner's alone, the same rule the
      // Payments page keeps. A supervisor sees the bills and nothing else.
      canSeeExpenses={viewer.role === "owner"}
      // Dates start on the workspace's calendar, not the browser's.
      today={today}
      initialTab={prefill ? "bills" : tab}
      prefill={prefill}
      prefillError={prefillError}
    />
  )
}

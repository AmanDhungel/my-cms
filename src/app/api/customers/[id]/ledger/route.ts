import type { NextRequest } from "next/server"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { partyLedger } from "@/lib/ledger"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Customer, toCustomerDTO } from "@/models/customer"

export const runtime = "nodejs"

/**
 * One party's account with the business.
 *
 * Owner only. A supervisor raises bills and takes payments, but what a
 * customer owes across all of them — and what the business has paid a
 * supplier to date — is the owner's view.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/customers/[id]/ledger">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)

    const party = await Customer.findOne({
      _id: id,
      business: viewer.businessId,
    })
    if (!party) throw new HttpError(404, "That party doesn't exist")

    const ledger = await partyLedger(
      viewer.businessId,
      id,
      business.timeZone,
      dayKeyInZone
    )

    return ok({ party: toCustomerDTO(party), ledger })
  } catch (error) {
    return handleApiError(error)
  }
}

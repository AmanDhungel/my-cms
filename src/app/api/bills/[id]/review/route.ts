import { randomBytes } from "node:crypto"

import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { inviteReviewSchema } from "@/lib/validations/review"
import { Bill, toBillDTO } from "@/models/bill"

export const runtime = "nodejs"

async function findQuotation(businessId: string, id: string) {
  const bill = await Bill.findOne({ _id: id, business: businessId })
  if (!bill) throw new HttpError(404, "That bill doesn't exist")

  // Only a quotation is up for discussion. An issued bill is a charge, and
  // inviting somebody to request changes to one would be inviting confusion.
  if (bill.payment !== "quotation") {
    throw new HttpError(409, "Only a quotation can be sent for review")
  }
  return bill
}

/**
 * Share a quotation with the client.
 *
 * Returns a link rather than sending one: EMS has no mail or SMS gateway, so
 * the owner passes it on themselves — by email, by message, however they
 * already talk to this client. The token is the whole credential, so it is
 * long, random, expiring and revocable.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/bills/[id]/review">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params
    const values = inviteReviewSchema.parse(await request.json())

    await connectToDatabase()
    const bill = await findQuotation(viewer.businessId, id)

    /*
     * A fresh token every time it is shared.
     *
     * Re-sharing after a revoke has to invalidate the old link, and reusing
     * the token would quietly bring it back to life.
     */
    const token = randomBytes(24).toString("base64url")
    const expiresAt = new Date(Date.now() + values.days * 86_400_000)

    bill.set("review", {
      token,
      invitedTo: values.invitedTo,
      invitedAt: new Date(),
      expiresAt,
      revokedAt: undefined,
      status: "pending",
      decidedAt: undefined,
      clientName: bill.review?.clientName,
      // Remarks survive a re-share: the conversation so far is still the
      // conversation.
      remarks: bill.review?.remarks ?? [],
    })
    await bill.save()

    void logActivity({
      businessId: viewer.businessId,
      action: "quote_shared",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: bill.number,
      detail: `to ${values.invitedTo}`,
      targetKind: "quote",
      targetId: bill._id,
      href: `/dashboard/sales/${String(bill._id)}`,
    })

    return ok({
      bill: toBillDTO(bill),
      url: new URL(`/quote/${token}`, request.nextUrl.origin).toString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Withdraw the link. The remarks stay; the door closes. */
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/bills/[id]/review">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { id } = await ctx.params

    await connectToDatabase()
    const bill = await findQuotation(viewer.businessId, id)

    if (!bill.review?.invitedAt) {
      throw new HttpError(409, "That quotation hasn't been shared")
    }

    bill.set("review.revokedAt", new Date())
    // Cleared outright rather than just flagged: a token that no longer
    // exists cannot be resurrected by a bug in a later check.
    bill.set("review.token", undefined)
    await bill.save()

    void logActivity({
      businessId: viewer.businessId,
      action: "quote_revoked",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: bill.number,
      targetKind: "quote",
      targetId: bill._id,
      href: `/dashboard/sales/${String(bill._id)}`,
    })

    return ok({ bill: toBillDTO(bill) })
  } catch (error) {
    return handleApiError(error)
  }
}

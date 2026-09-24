import type { NextRequest } from "next/server"

import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { notifyUser } from "@/lib/notify"
import { findQuoteByToken, toPublicQuote } from "@/lib/quote-review"
import { clientReviewSchema } from "@/lib/validations/review"
import { Business } from "@/models/business"

export const runtime = "nodejs"

/**
 * The client's end of a quotation.
 *
 * No session, by design: the token in the URL is the whole credential.
 * Everything it can reach is this one quotation — not the customer record
 * behind it, not the workspace, not another bill — so a forwarded link leaks
 * exactly the document it was meant to share.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/quote/[token]">
) {
  try {
    const { token } = await ctx.params
    const found = await findQuoteByToken(token)
    if (!found) throw new HttpError(404, "This link is no longer good")

    return ok({ quote: toPublicQuote(found.bill, found.businessName) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * What the client has to say.
 *
 * A remark, a decision, or both. Approving does not turn the quotation into a
 * bill — that stays the workspace's own act, because a client clicking
 * "approve" is an agreement, not an invoice.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/quote/[token]">
) {
  try {
    const { token } = await ctx.params
    const values = clientReviewSchema.parse(await request.json())

    const found = await findQuoteByToken(token)
    if (!found) throw new HttpError(404, "This link is no longer good")

    const { bill } = found
    const author = values.clientName || bill.customer.name || "The client"

    // A remark about a line has to be about a line that exists.
    if (
      values.lineIndex !== undefined &&
      values.lineIndex >= bill.lines.length
    ) {
      throw new HttpError(400, "That line isn't on this quotation")
    }

    if (values.remark) {
      bill.review?.remarks?.push({
        lineIndex: values.lineIndex,
        text: values.remark,
        author,
        fromClient: true,
        at: new Date(),
      } as never)
    }

    if (values.decision) {
      bill.set("review.status", values.decision)
      bill.set("review.decidedAt", new Date())
    }
    if (values.clientName) bill.set("review.clientName", values.clientName)

    await bill.save()

    /*
     * The owner hears about it.
     *
     * This is the only part of the client's action that reaches into the
     * workspace, and it is one-way: a notification and a log line, addressed
     * to the person who raised the quotation.
     */
    const business = await Business.findById(bill.business).select("owner")
    const ownerId = business?.owner ? String(business.owner) : null

    if (ownerId) {
      void notifyUser({
        userId: ownerId,
        businessId: String(bill.business),
        kind: "request_decided",
        title:
          values.decision === "approved"
            ? `${author} approved ${bill.number}`
            : values.decision === "changes_requested"
              ? `${author} wants changes to ${bill.number}`
              : `${author} commented on ${bill.number}`,
        body: values.remark,
        href: `/dashboard/sales/${String(bill._id)}`,
      })
    }

    void logActivity({
      businessId: String(bill.business),
      action: "quote_reviewed",
      actorId: String(bill.issuedBy),
      // The client is not a member, so the log names them as themselves
      // rather than pretending one of the crew did this.
      actorName: author,
      subject: bill.number,
      detail:
        values.decision === "approved"
          ? "approved it"
          : values.decision === "changes_requested"
            ? "asked for changes"
            : "left a remark",
      targetKind: "quote",
      targetId: bill._id,
      href: `/dashboard/sales/${String(bill._id)}`,
    })

    return ok({ quote: toPublicQuote(bill, found.businessName) })
  } catch (error) {
    return handleApiError(error)
  }
}

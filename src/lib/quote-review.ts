import { connectToDatabase } from "@/lib/mongodb"
import { Bill, type BillDocument } from "@/models/bill"
import { Business } from "@/models/business"
import type { HydratedDocument } from "mongoose"

/**
 * A quotation as its client sees it.
 *
 * Everything here runs for somebody with no session at all, so the rules are
 * strict and all in one place: the token has to match, the link has to be
 * live, and the workspace has to be in good standing. A failure of any of
 * them looks the same from outside — nothing found — because telling a
 * stranger that a token exists but has expired is telling them a token
 * exists.
 */

export type PublicQuoteLine = {
  name: string
  unit: string
  price: number
  qty: number
  discountPct: number
  /** What this line comes to after its own discount. */
  total: number
}

export type PublicQuote = {
  number: string
  business: string
  customer: string
  lines: PublicQuoteLine[]
  subtotal: number
  discountTotal: number
  taxable: number
  vatRate: number
  vatAmount: number
  total: number
  note: string | null
  issuedOn: string
  status: string
  decidedAt: string | null
  clientName: string | null
  remarks: {
    lineIndex: number | null
    text: string
    author: string
    fromClient: boolean
    at: string
  }[]
}

/** The bill behind a token, or null for every reason a stranger gets nothing. */
export async function findQuoteByToken(token: string) {
  if (!token || token.length < 16) return null
  await connectToDatabase()

  const bill = await Bill.findOne({ "review.token": token })
  if (!bill) return null

  const review = bill.review
  if (!review?.token || review.revokedAt) return null
  if (review.expiresAt && (review.expiresAt as Date).getTime() < Date.now()) {
    return null
  }
  // A quotation that has since been turned into a real bill is no longer up
  // for discussion.
  if (bill.payment !== "quotation" || bill.status !== "issued") return null

  const business = await Business.findById(bill.business).select(
    "name blockedAt"
  )
  if (!business || business.blockedAt) return null

  return { bill, businessName: business.name }
}

export function toPublicQuote(
  bill: HydratedDocument<BillDocument>,
  businessName: string
): PublicQuote {
  const round2 = (value: number) => Math.round(value * 100) / 100

  return {
    number: bill.number,
    business: businessName,
    customer: bill.customer.name,
    lines: bill.lines.map((line) => ({
      name: line.name,
      unit: line.unit,
      price: line.price,
      qty: line.qty,
      discountPct: line.discountPct,
      total: round2(line.price * line.qty * (1 - line.discountPct / 100)),
    })),
    subtotal: bill.subtotal,
    discountTotal: bill.discountTotal,
    taxable: bill.taxable,
    vatRate: bill.vatRate,
    vatAmount: bill.vatAmount,
    total: bill.total,
    note: bill.note ?? null,
    issuedOn: (bill.createdAt as Date).toISOString(),
    status: bill.review?.status ?? "pending",
    decidedAt: bill.review?.decidedAt
      ? (bill.review.decidedAt as Date).toISOString()
      : null,
    clientName: bill.review?.clientName ?? null,
    remarks: (bill.review?.remarks ?? []).map((one) => ({
      lineIndex: one.lineIndex ?? null,
      text: one.text,
      author: one.author,
      fromClient: one.fromClient,
      at: (one.at as Date).toISOString(),
    })),
  }
}

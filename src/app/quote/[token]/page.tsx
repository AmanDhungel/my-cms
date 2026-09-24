import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { QuoteReview } from "@/components/quote/quote-review"
import { findQuoteByToken, toPublicQuote } from "@/lib/quote-review"

export const metadata: Metadata = {
  title: "Quotation",
  // A quotation is a private document that happens to have a public address.
  robots: { index: false, follow: false },
}

/**
 * A quotation, for the client it was sent to.
 *
 * No sign-in: the token in the address is the whole credential, which is what
 * makes it possible to get an answer out of somebody who has never heard of
 * EMS. The proxy leaves this path alone — only /dashboard, /admin and
 * /choose are gated — so a stranger reaches it directly.
 */
export default async function QuotePage({
  params,
}: PageProps<"/quote/[token]">) {
  const { token } = await params
  const found = await findQuoteByToken(token)

  // Expired, revoked, never existed and belonging to a blocked workspace all
  // end here identically: a stranger learns nothing from which it was.
  if (!found) notFound()

  return (
    <QuoteReview
      token={token}
      initial={toPublicQuote(found.bill, found.businessName)}
    />
  )
}

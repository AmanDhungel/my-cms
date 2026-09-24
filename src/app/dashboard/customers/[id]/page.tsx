import type { Metadata } from "next"

import { PartyLedgerView } from "@/components/dashboard/customers/party-ledger-view"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Party · EMS" }

/**
 * One party's account with the business.
 *
 * Owner only, like the other money pages: a supervisor raises the bills and
 * takes the payments, but what someone owes across all of them is the
 * owner's view.
 */
export default async function PartyPage({
  params,
}: PageProps<"/dashboard/customers/[id]">) {
  await requirePageRole("owner")
  const { id } = await params

  return <PartyLedgerView id={id} />
}

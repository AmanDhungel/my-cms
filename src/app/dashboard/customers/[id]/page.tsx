import type { Metadata } from "next"

import { KhataView } from "@/components/dashboard/customers/khata-view"
import { PartyLedgerView } from "@/components/dashboard/customers/party-ledger-view"
import { PartyTabs } from "@/components/dashboard/customers/party-tabs"
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
  searchParams,
}: PageProps<"/dashboard/customers/[id]">) {
  await requirePageRole("owner")
  const { id } = await params
  // ?tab=ledger opens the plain-language ledger; the page as it always was
  // is the Overview, and stays the default.
  const tab = (await searchParams).tab === "ledger" ? "ledger" : "overview"

  return tab === "ledger" ? (
    <KhataView id={id} tabs={<PartyTabs id={id} tab="ledger" />} />
  ) : (
    <PartyLedgerView id={id} tabs={<PartyTabs id={id} tab="overview" />} />
  )
}

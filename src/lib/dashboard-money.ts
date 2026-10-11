import { fromPaisa } from "@/lib/allocations"
import { estimateState, type EstimateStatus } from "@/lib/estimates"
import { collectAndPay } from "@/lib/khata"
import { khataBalances } from "@/lib/ledger"
import { dayKeyInZone } from "@/lib/time"
import { Estimate } from "@/models/estimate"

/**
 * The numbers behind the dashboard's money widgets. To collect / To pay are
 * the khata's balances summed (lib/khata.ts collectAndPay) — the same figures
 * as the Parties list strip. Open estimates: Draft, Sent or Accepted and not
 * expired; they are offers, so they appear in no other total.
 */
export async function dashboardMoney(
  businessId: string,
  zone: string,
  options: { balances: boolean }
) {
  const today = dayKeyInZone(new Date(), zone)
  const [rows, estimates] = await Promise.all([
    options.balances ? khataBalances(businessId, zone) : Promise.resolve(null),
    Estimate.find({ business: businessId, status: { $in: ["draft", "sent", "accepted"] } }).select(
      "status validUntil total"
    ),
  ])
  const open = estimates.filter(
    (one) => estimateState(one.status as EstimateStatus, dayKeyInZone(one.validUntil, zone), today) !== "expired"
  )
  const sums = rows ? collectAndPay(rows.map((row) => row.balance)) : null
  return {
    toCollect: sums ? fromPaisa(sums.toCollect) : null,
    toPay: sums ? fromPaisa(sums.toPay) : null,
    openEstimates: { count: open.length, total: open.reduce((sum, one) => sum + one.total, 0) },
  }
}

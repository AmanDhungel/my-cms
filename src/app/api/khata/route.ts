import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { fromPaisa } from "@/lib/allocations"
import { balanceTone, collectAndPay } from "@/lib/khata"
import { khataBalances } from "@/lib/ledger"
import { getWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

/**
 * Where every party stands, in plain words: + they owe you, − you owe them
 * (lib/khata.ts), with the To collect / To pay totals. Owner only, like the
 * rest of the money pages.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner")
    const business = await getWorkspace(viewer)
    const rows = await khataBalances(viewer.businessId, business.timeZone)
    const { toCollect, toPay } = collectAndPay(rows.map((row) => row.balance))

    return ok({
      parties: rows.map((row) => ({
        id: String(row.party._id),
        name: row.party.name,
        kind: row.party.kind ?? "customer",
        phone: row.party.phone ?? null,
        balance: fromPaisa(row.balance),
        tone: balanceTone(row.balance),
      })),
      toCollect: fromPaisa(toCollect),
      toPay: fromPaisa(toPay),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

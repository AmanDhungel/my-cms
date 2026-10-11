import type { NextRequest } from "next/server"

import { handleApiError, HttpError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { fromPaisa } from "@/lib/allocations"
import {
  agingOf,
  balanceOf,
  balanceTone,
  buildStatement,
  openItems,
  type KhataType,
} from "@/lib/khata"
import { loadKhata } from "@/lib/ledger"
import { settleStatus } from "@/lib/settlement"
import { dayKeyInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Customer, toCustomerDTO } from "@/models/customer"

export const runtime = "nodejs"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TYPES: readonly KhataType[] = ["sales", "purchases", "payments"]

/**
 * One party's statement — the Ledger tab and its printout (lib/khata.ts).
 *
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   the period; both optional (All time)
 *   ?types=sales,purchases,payments  which rows to list; the running
 *                                    balance is never affected by it
 *
 * Also returns what is still open, item by item (bill-wise outstanding),
 * and how late it is. Owner only.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/customers/[id]/statement">
) {
  try {
    const viewer = await requireRole("owner")
    const { id } = await ctx.params
    const params = request.nextUrl.searchParams
    const from = params.get("from")
    const to = params.get("to")
    if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
      throw new HttpError(422, "Pick a date", { from: ["Pick a date"] })
    }
    const types = (params.get("types") ?? "")
      .split(",")
      .filter((type): type is KhataType => (TYPES as readonly string[]).includes(type))

    const business = await getWorkspace(viewer)
    const party = await Customer.findOne({ _id: id, business: viewer.businessId })
    if (!party) throw new HttpError(404, "That party doesn't exist")

    const today = dayKeyInZone(new Date(), business.timeZone)
    const { events } = await loadKhata(viewer.businessId, business.timeZone)
    const mine = events.get(String(party._id)) ?? []
    const balance = balanceOf(mine)
    const statement = buildStatement(mine, { from, to, types })
    const open = openItems(mine)

    // Each open sale or purchase: its total, what is paid, what is left.
    const sales = open.filter((item) => item.kind === "sale" || item.kind === "purchase")
    const unapplied = open.filter((item) => item.kind !== "sale" && item.kind !== "purchase")

    return ok({
      business: { name: business.name },
      party: toCustomerDTO(party),
      today,
      balance: fromPaisa(balance),
      tone: balanceTone(balance),
      statement: {
        from: from ?? null,
        to: to ?? null,
        opening: fromPaisa(statement.opening),
        closing: fromPaisa(statement.closing),
        billed: fromPaisa(statement.billed),
        paid: fromPaisa(statement.paid),
        rows: statement.rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          on: row.on,
          what: row.what,
          detail: row.detail,
          billed: fromPaisa(row.billed),
          paid: fromPaisa(row.paid),
          running: fromPaisa(row.running),
          href: row.href,
        })),
      },
      open: sales.map((item) => {
        const total = item.amount
        const due = Math.abs(item.remaining)
        return {
          id: item.id,
          kind: item.kind,
          what: item.what,
          on: item.on,
          dueOn: item.dueOn,
          href: item.href,
          total: fromPaisa(total),
          paid: fromPaisa(total - due),
          due: fromPaisa(due),
          settlement: settleStatus({
            totalPaisa: total,
            paidPaisa: total - due,
            duePaisa: due,
            dueOn: item.dueOn,
            today,
          }),
        }
      }),
      // Money on account that isn't matched to a bill yet (or paid out to them).
      unapplied: unapplied.map((item) => ({
        id: item.id,
        kind: item.kind,
        what: item.what,
        on: item.on,
        amount: fromPaisa(Math.abs(item.remaining)),
      })),
      aging: Object.fromEntries(
        Object.entries(agingOf(open, today)).map(([key, value]) => [
          key,
          key === "oldestDays" ? value : fromPaisa(value),
        ])
      ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import type { NextRequest } from "next/server"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import {
  REPORT_GROUPS,
  reportsIn,
  type ReportGroup,
  type ReportPayload,
} from "@/lib/reports"
import { buildReport, scopeFrom } from "@/lib/report-runner"
import { getWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

/**
 * One category's reports at a glance: every chart in the group, in one
 * request.
 *
 * The hub could have asked for each report separately, but that is eight
 * round trips to draw one screen — and eight chances for the cards to
 * disagree about what "this month" means. Running them together here means
 * every card on the page shares one window.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/report-groups/[group]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { group } = await ctx.params

    if (!REPORT_GROUPS.includes(group as ReportGroup)) {
      throw new HttpError(404, "There's no such group of reports")
    }

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)
    const scope = scopeFrom(request.nextUrl.searchParams, {
      businessId: viewer.businessId,
      zone: business.timeZone,
    })

    const defs = reportsIn(group as ReportGroup)

    // Blocked reports have nothing to run; they still appear on the hub, as a
    // card that explains itself.
    const runnable = defs.filter((def) => def.status !== "blocked")

    const results = await Promise.all(
      runnable.map(async (def) => {
        try {
          const payload = await buildReport(def.slug, scope)
          return { slug: def.slug, payload }
        } catch (error) {
          // One report falling over must not take the whole hub with it.
          console.error("[report-group]", def.slug, error)
          return { slug: def.slug, payload: null as ReportPayload | null }
        }
      })
    )

    const byslug = new Map(results.map((one) => [one.slug, one.payload]))

    return ok({
      group,
      reports: defs.map((def) => {
        const payload = byslug.get(def.slug) ?? null
        return {
          slug: def.slug,
          title: def.title,
          subtitle: def.subtitle,
          status: def.status,
          missing: def.missing,
          chart: payload?.chart ?? null,
          // Two headline figures is what a card has room for; the rest are
          // on the report itself.
          stats: (payload?.stats ?? []).slice(0, 2),
          rows: payload?.rows.length ?? 0,
        }
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

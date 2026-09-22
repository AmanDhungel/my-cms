import type { NextRequest } from "next/server"

import { handleApiError, HttpError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { buildReport, scopeFrom } from "@/lib/report-runner"
import { REPORT_BY_SLUG } from "@/lib/reports"
import { getWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

/**
 * Every report runs through here. One route rather than twenty-odd, because
 * they differ only in the query behind them — the shape they hand back, and
 * therefore the table, the filters and the export, is the same for all.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/reports/[report]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { report: slug } = await ctx.params

    const def = REPORT_BY_SLUG.get(slug)
    if (!def) throw new HttpError(404, "There's no such report")

    if (def.status === "blocked") {
      // Nothing to run. The page explains itself from the registry.
      return ok({ slug, blocked: true, missing: def.missing, unlock: def.unlock })
    }

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)

    const payload = await buildReport(
      slug,
      scopeFrom(request.nextUrl.searchParams, {
        businessId: viewer.businessId,
        zone: business.timeZone,
      })
    )

    return ok({ ...payload, blocked: false, note: def.missing ?? payload.note })
  } catch (error) {
    return handleApiError(error)
  }
}

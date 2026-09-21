import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone, dayRangeInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Operation } from "@/models/operation"
import { Task } from "@/models/task"
import { OPERATION_POPULATE } from "@/lib/operations-server"

export const runtime = "nodejs"

/**
 * One month, flattened into things that happen on a day.
 *
 * Tasks ride along with the operations: they are the workspace's other dated
 * record, and a calendar that showed meetings but not the jobs they are about
 * would be the wrong shape of empty.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const month = normaliseMonth(
      request.nextUrl.searchParams.get("month"),
      today.slice(0, 7)
    )

    // The month's own bounds, in the workspace's zone rather than the host's.
    const { start } = dayRangeInZone(`${month}-01`, business.timeZone)
    const { start: end } = dayRangeInZone(
      `${nextMonth(month)}-01`,
      business.timeZone
    )

    const [operations, tasks] = await Promise.all([
      Operation.find({
        business: business._id,
        startAt: { $gte: start, $lt: end },
      })
        .sort({ startAt: 1 })
        .limit(500)
        .populate(OPERATION_POPULATE),
      Task.find({
        business: business._id,
        startAt: { $gte: start, $lt: end },
        status: { $ne: "cancelled" },
      })
        .sort({ startAt: 1 })
        .limit(500)
        .populate({ path: "assignees", select: "name" }),
    ])

    const zone = business.timeZone

    const items = [
      ...operations.map((entry) => ({
        id: String(entry._id),
        source: "operation" as const,
        kind: entry.kind,
        title: entry.title,
        day: dayKeyInZone(entry.startAt, zone),
        startAt: entry.startAt.toISOString(),
        endAt: entry.endAt ? entry.endAt.toISOString() : null,
        allDay: entry.allDay,
        status: entry.status,
        priority: entry.priority,
        people: (entry.assignees ?? [])
          .map((ref) => (ref as { name?: string })?.name)
          .filter(Boolean) as string[],
        where:
          entry.location ??
          (entry.customer as { name?: string } | null)?.name ??
          null,
      })),
      ...tasks.map((task) => ({
        id: String(task._id),
        source: "task" as const,
        kind: "task" as const,
        title: task.title,
        day: dayKeyInZone(task.startAt, zone),
        startAt: task.startAt.toISOString(),
        endAt: task.endAt.toISOString(),
        allDay: false,
        status: task.status,
        priority: task.priority,
        people: (task.assignees ?? [])
          .map((ref) => (ref as { name?: string })?.name)
          .filter(Boolean) as string[],
        where: task.site,
      })),
    ].sort((a, b) => a.startAt.localeCompare(b.startAt))

    return ok({
      month,
      today,
      timeZone: zone,
      items,
      summary: {
        total: items.length,
        operations: operations.length,
        tasks: tasks.length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function normaliseMonth(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : fallback
}

function nextMonth(month: string) {
  const [year, m] = month.split("-").map(Number)
  const moved = new Date(Date.UTC(year, m, 1))
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`
}

import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { autoCloseFinishedShifts } from "@/lib/attendance"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { restsOn, weekFor } from "@/lib/week-server"
import { getWorkspace } from "@/lib/workspace"
import { Attendance, toAttendanceDTO } from "@/models/attendance"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * One day of the whole crew's attendance — who opened their day, when, and
 * where they were standing when they did.
 *
 * Everyone on the crew appears, including the people who never turned up:
 * an absence is the row an owner most wants to see, and it exists nowhere in
 * the database, so it is filled in here against the member list.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const day = normaliseDay(request.nextUrl.searchParams.get("day"), today)

    // Removed people stay listed for days they actually worked, so history
    // doesn't lose them — but they aren't marked absent for days after.
    const members = await User.find({ business: business._id }).select(
      "name role shift status removedAt week"
    )

    // A day nobody closed is closed here first, so the owner isn't reading
    // shifts that appear to still be running days later.
    await Promise.all(
      members.map((member) =>
        autoCloseFinishedShifts({
          userId: member._id,
          fallbackShift: member.shift,
          timeZone: business.timeZone,
        })
      )
    )

    const records = await Attendance.find({
      business: business._id,
      day,
    })

    const byUser = new Map(
      records.map((record) => [String(record.user), record])
    )

    const rows = members
      .filter((member) => {
        if (member.status !== "removed") return true
        // Someone removed mid-month still shows on the days they worked.
        return byUser.has(String(member._id))
      })
      .map((member) => {
        const record = byUser.get(String(member._id))
        return {
          user: {
            id: String(member._id),
            name: member.name,
            role: member.role,
            shift: member.shift ?? null,
            removed: member.status === "removed",
            /** Their repeating week says they were never due in today. */
            resting: restsOn(day, member, business),
            week: weekFor(member, business),
          },
          attendance: record ? toAttendanceDTO(record) : null,
        }
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name))

    const present = rows.filter((row) => row.attendance?.inAt).length
    const resting = rows.filter(
      (row) => row.user.resting && !row.attendance?.inAt
    ).length

    return ok({
      day,
      today,
      timeZone: business.timeZone,
      rows,
      summary: {
        crew: rows.length,
        present,
        resting,
        // A rest day is not an absence — that is the whole point of a week.
        absent: rows.length - present - resting,
        late: rows.filter((row) => row.attendance?.status === "late").length,
        leave: rows.filter((row) => row.attendance?.status === "leave").length,
        // Days opened from outside the office's outer ring, which are the
        // ones carrying a reason.
        away: rows.filter((row) => row.attendance?.inPlace === "away").length,
        stillIn: rows.filter(
          (row) => row.attendance?.inAt && !row.attendance.outAt
        ).length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function normaliseDay(value: string | null, today: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today
}

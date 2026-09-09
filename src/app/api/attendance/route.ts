import type { NextRequest } from "next/server"
import { Types } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import {
  autoCloseFinishedShifts,
  markArrival,
  markDeparture,
} from "@/lib/attendance"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { attendanceActionSchema } from "@/lib/validations/work"
import { getWorkspace } from "@/lib/workspace"
import { Attendance, toAttendanceDTO } from "@/models/attendance"
import { User } from "@/models/user"

export const runtime = "nodejs"

/** A month of attendance. Employees can only ever read their own. */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser()
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const params = request.nextUrl.searchParams

    const today = dayKeyInZone(new Date(), business.timeZone)
    const month = normaliseMonth(params.get("month"), today)

    let userId = viewer.id
    if (viewer.role !== "employee") {
      const requested = params.get("userId")
      if (requested && Types.ObjectId.isValid(requested)) {
        const target = await User.findOne({
          _id: requested,
          business: business._id,
        })
        if (!target) throw new HttpError(404, "That person isn't in this workspace")
        userId = requested
      }
    }

    // Close anything the shift has outlasted before reading, so a day nobody
    // ended doesn't sit open forever.
    const owner = await User.findById(userId).select("shift")
    await autoCloseFinishedShifts({
      userId,
      fallbackShift: owner?.shift,
      timeZone: business.timeZone,
    })

    const records = await Attendance.find({
      user: userId,
      day: { $gte: `${month}-01`, $lte: `${month}-31` },
    }).sort({ day: 1 })

    const days = records.map(toAttendanceDTO)

    return ok({
      month,
      today,
      timeZone: business.timeZone,
      days,
      summary: {
        present: days.filter((d) => d.status === "present").length,
        late: days.filter((d) => d.status === "late").length,
        leave: days.filter((d) => d.status === "leave").length,
        absent: days.filter((d) => d.status === "absent").length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Start / End shift. This is the "manual" source that outranks check-ins. */
export async function POST(request: Request) {
  try {
    const viewer = await requireUser()
    const { action } = attendanceActionSchema.parse(await request.json())

    await connectToDatabase()

    const [business, me] = await Promise.all([
      getWorkspace(viewer.businessId),
      User.findById(viewer.id).select("shift"),
    ])

    const at = new Date()
    const day = dayKeyInZone(at, business.timeZone)
    const existing = await Attendance.findOne({ user: viewer.id, day })

    // Both guards make a repeated submit a no-op error rather than a
    // second record.
    if (action === "start" && existing?.inSource === "manual") {
      throw new HttpError(409, "Your shift is already started")
    }
    if (action === "end") {
      if (!existing?.inAt) {
        throw new HttpError(409, "Start your shift before ending it")
      }
      if (existing.outSource === "manual") {
        throw new HttpError(409, "Your shift is already ended")
      }
    }

    const record =
      action === "start"
        ? await markArrival({
            businessId: business._id,
            userId: viewer.id,
            at,
            source: "manual",
            shift: me?.shift,
            timeZone: business.timeZone,
          })
        : await markDeparture({
            businessId: business._id,
            userId: viewer.id,
            at,
            source: "manual",
            shift: me?.shift,
            timeZone: business.timeZone,
          })

    return ok({ attendance: toAttendanceDTO(record) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

/** "2026-09", falling back to the month `today` sits in. */
function normaliseMonth(value: string | null, today: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : today.slice(0, 7)
}

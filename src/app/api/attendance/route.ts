import type { NextRequest } from "next/server"
import { Types } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import {
  autoCloseFinishedShifts,
  markArrival,
  markDeparture,
} from "@/lib/attendance"
import { formatDistance } from "@/lib/geo"
import { connectToDatabase } from "@/lib/mongodb"
import {
  AWAY_REASON_LABELS,
  PLACE_LABELS,
  placeAgainstOffice,
  type ShiftPlacement,
} from "@/lib/office"
import { dayKeyInZone } from "@/lib/time"
import { shiftOn, weekFor } from "@/lib/week-server"
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
    const owner = await User.findById(userId).select("shift week")
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
      // The repeating week, so a rest day reads as off rather than absent.
      week: weekFor(owner, business),
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
    const values = attendanceActionSchema.parse(await request.json())
    const { action } = values

    await connectToDatabase()

    const [business, me] = await Promise.all([
      getWorkspace(viewer.businessId),
      User.findById(viewer.id).select("shift week"),
    ])

    /**
     * A workspace with an office measures the start against it. Without one
     * nothing is asked, which is how every workspace behaved before offices
     * existed — and how one behaves until its owner pins theirs.
     */
    let place: ShiftPlacement | null = null

    if (business.office) {
      // Opening the day needs a position; closing it only records one if the
      // phone offered it. Nobody should be kept at work by a refused fix.
      if (
        action === "start" &&
        (values.lat === undefined || values.lng === undefined)
      ) {
        throw new HttpError(
          400,
          "Share your location to start your shift — your workspace records where the day opened."
        )
      }

      if (values.lat !== undefined && values.lng !== undefined) {
        place = placeAgainstOffice(business.office, {
          lat: values.lat,
          lng: values.lng,
        })
      }

      // The phone asks first; this is the half that can't be skipped.
      if (action === "start" && place?.needsReason && !values.reason) {
        throw new HttpError(
          409,
          `You are ${formatDistance(place.distanceM)} from the office. Say why you are starting from here.`
        )
      }
    }

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
            shift: shiftOn(day, me, business),
            timeZone: business.timeZone,
            place:
              place && values.lat !== undefined && values.lng !== undefined
                ? {
                    place: place.place,
                    distanceM: place.distanceM,
                    lat: values.lat,
                    lng: values.lng,
                    accuracyM: values.accuracyM,
                    // Only kept where it was actually required.
                    reason: place.needsReason ? values.reason : undefined,
                    note: place.needsReason ? values.note : undefined,
                  }
                : undefined,
          })
        : await markDeparture({
            businessId: business._id,
            userId: viewer.id,
            at,
            source: "manual",
            shift: shiftOn(day, me, business),
            timeZone: business.timeZone,
            place:
              place && values.lat !== undefined && values.lng !== undefined
                ? {
                    place: place.place,
                    distanceM: place.distanceM,
                    lat: values.lat,
                    lng: values.lng,
                    accuracyM: values.accuracyM,
                  }
                : undefined,
          })

    await logActivity({
      businessId: business._id,
      action: action === "start" ? "shift_started" : "shift_ended",
      actorId: viewer.id,
      actorName: viewer.name,
      // The sentence already reads "started their shift"; the subject is the
      // person, so the log can be filtered by them.
      subject: viewer.name,
      detail: whereFrom(place, values.reason, values.note),
      targetKind: "member",
      targetId: viewer.id,
      href: "/dashboard/attendance",
      at,
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

/**
 * The second line of a shift entry in the log — where it happened and, when
 * one was required, why. Empty on a workspace with no office pinned.
 */
function whereFrom(
  place: ShiftPlacement | null,
  reason?: string,
  note?: string
) {
  if (!place) return undefined

  const head = `${PLACE_LABELS[place.place]} · ${formatDistance(place.distanceM)} away`
  if (!place.needsReason || !reason) return head

  const why = AWAY_REASON_LABELS[reason as keyof typeof AWAY_REASON_LABELS]
  return note ? `${head} · ${why} — ${note}` : `${head} · ${why}`
}

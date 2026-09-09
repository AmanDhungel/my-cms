import type { QueryFilter, Types } from "mongoose"

import {
  dayKeyInZone,
  dayRangeInZone,
  lateByMinutes,
  parseShift,
} from "@/lib/time"
import {
  Attendance,
  LATE_GRACE_MIN,
  type AttendanceDocument,
  type AttendanceSource,
} from "@/models/attendance"

type Mark = {
  businessId: string | Types.ObjectId
  userId: string | Types.ObjectId
  at: Date
  source: AttendanceSource
  shift?: string | null
  timeZone: string
}

/**
 * Attendance is reconciled from two inputs: the employee pressing Start/End
 * shift ("manual") and their task check-ins ("derived"). Manual always wins;
 * between derived events the earliest arrival and the latest departure win.
 *
 * Every write is guarded by the same condition it depends on, so two check-ins
 * landing at once can't lose one another's update.
 */
export async function markArrival({
  businessId,
  userId,
  at,
  source,
  shift,
  timeZone,
}: Mark) {
  const day = dayKeyInZone(at, timeZone)
  const record = await ensureDay({ businessId, userId, day, shift })

  const guard: QueryFilter<AttendanceDocument> =
    source === "manual"
      ? {
          $or: [
            { inAt: { $exists: false } },
            { inAt: null },
            { inSource: "derived" },
            { inAt: { $gt: at } },
          ],
        }
      : {
          inSource: { $ne: "manual" },
          $or: [{ inAt: { $exists: false } }, { inAt: null }, { inAt: { $gt: at } }],
        }

  const lateBy = lateByMinutes(at, shift, timeZone, LATE_GRACE_MIN)

  await Attendance.updateOne(
    { _id: record._id, ...guard },
    {
      $set: {
        inAt: at,
        inSource: source,
        lateByMin: lateBy,
        // An approved leave day keeps its status; nothing else overrides it.
        ...(record.status === "leave" ? {} : { status: lateBy > 0 ? "late" : "present" }),
      },
    }
  )

  return Attendance.findById(record._id).orFail()
}

export async function markDeparture({
  businessId,
  userId,
  at,
  source,
  shift,
  timeZone,
}: Mark) {
  const day = dayKeyInZone(at, timeZone)
  const record = await ensureDay({ businessId, userId, day, shift })

  const guard: QueryFilter<AttendanceDocument> =
    source === "manual"
      ? {
          $or: [
            { outAt: { $exists: false } },
            { outAt: null },
            { outSource: "derived" },
            { outAt: { $lt: at } },
          ],
        }
      : {
          outSource: { $ne: "manual" },
          $or: [
            { outAt: { $exists: false } },
            { outAt: null },
            { outAt: { $lt: at } },
          ],
        }

  await Attendance.updateOne(
    { _id: record._id, ...guard },
    { $set: { outAt: at, outSource: source } }
  )

  return Attendance.findById(record._id).orFail()
}

/**
 * Upserts the day row. The unique (user, day) index is what makes this safe:
 * a racing insert loses with a duplicate-key error and we read the winner.
 */
async function ensureDay({
  businessId,
  userId,
  day,
  shift,
}: {
  businessId: string | Types.ObjectId
  userId: string | Types.ObjectId
  day: string
  shift?: string | null
}) {
  try {
    return await Attendance.findOneAndUpdate(
      { user: userId, day },
      {
        $setOnInsert: {
          business: businessId,
          user: userId,
          day,
          shift: shift ?? null,
          status: "present",
          lateByMin: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).orFail()
  } catch (error) {
    if (isDuplicateKey(error)) {
      return Attendance.findOne({ user: userId, day }).orFail()
    }
    throw error
  }
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  )
}

/**
 * Closes days that were opened but never ended, once the person's shift is
 * over. There's no scheduler here, so this runs lazily whenever attendance is
 * read — which is the moment anyone would notice the day still hanging open.
 *
 * Manual and derived departures are left alone; this only fills the gap.
 */
export async function autoCloseFinishedShifts({
  userId,
  fallbackShift,
  timeZone,
}: {
  userId: string | Types.ObjectId
  fallbackShift?: string | null
  timeZone: string
}) {
  const open = await Attendance.find({
    user: userId,
    inAt: { $ne: null },
    outAt: { $exists: false },
  })

  const now = Date.now()

  for (const record of open) {
    // The row's own snapshot wins: editing someone's shift shouldn't rewrite
    // how a day that already happened gets closed.
    const parsed = parseShift(record.shift ?? fallbackShift)
    if (!parsed) continue

    const { start } = dayRangeInZone(record.day, timeZone)
    const endsAt = new Date(start.getTime() + parsed.endMin * 60_000)

    if (endsAt.getTime() > now) continue

    await Attendance.updateOne(
      { _id: record._id, outAt: { $exists: false } },
      { $set: { outAt: endsAt, outSource: "auto" } }
    )
  }
}

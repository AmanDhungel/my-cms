import type { NextRequest } from "next/server"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { logActivity } from "@/lib/activity"
import { connectToDatabase } from "@/lib/mongodb"
import { weekFrom, weekStart } from "@/lib/operations"
import { dayKeyInZone } from "@/lib/time"
import { scheduleSchema } from "@/lib/validations/operations"
import { getWorkspace } from "@/lib/workspace"
import { Schedule, toScheduleDTO } from "@/models/schedule"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * A week of the roster, plus the crew it is drawn against — the grid needs
 * both, and asking for them separately would let the two disagree.
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()

    const business = await getWorkspace(viewer.businessId)
    const today = dayKeyInZone(new Date(), business.timeZone)
    const from = normaliseDay(request.nextUrl.searchParams.get("from"), weekStart(today))
    const days = weekFrom(from)

    const [members, rows] = await Promise.all([
      User.find({ business: business._id, status: { $ne: "removed" } })
        .select("name role shift")
        .sort({ name: 1 }),
      Schedule.find({
        business: business._id,
        day: { $gte: days[0], $lte: days[days.length - 1] },
      }),
    ])

    return ok({
      from: days[0],
      days,
      today,
      timeZone: business.timeZone,
      crew: members.map((member) => ({
        id: String(member._id),
        name: member.name,
        role: member.role,
        shift: member.shift ?? null,
      })),
      entries: rows.map(toScheduleDTO),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Rosters one person for one day. Upsert rather than create: the grid has one
 * cell per person per day, so saving the same cell twice is an edit, not a
 * clash — and the unique index makes that the only possible reading.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const values = scheduleSchema.parse(await request.json())

    await connectToDatabase()

    const member = await User.findOne({
      _id: values.userId,
      business: viewer.businessId,
    })

    if (!member) throw new HttpError(422, "That person isn't in this workspace")
    if (member.status === "removed") {
      throw new HttpError(409, `${member.name} is no longer on the crew`)
    }

    // An off or leave day carries no hours, whatever the form sent.
    const keepsHours = values.kind !== "off" && values.kind !== "leave"

    const entry = await Schedule.findOneAndUpdate(
      { user: member._id, day: values.day },
      {
        $set: {
          business: viewer.businessId,
          user: member._id,
          day: values.day,
          kind: values.kind,
          startTime: keepsHours ? values.startTime : undefined,
          endTime: keepsHours ? values.endTime : undefined,
          note: values.note,
          createdBy: viewer.id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).orFail()

    await logActivity({
      businessId: viewer.businessId,
      action: "schedule_set",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: member.name,
      detail: `${values.day} · ${values.kind}${
        keepsHours && values.startTime
          ? ` ${values.startTime}–${values.endTime}`
          : ""
      }`,
      targetKind: "schedule",
      targetId: entry._id,
      href: "/dashboard/schedules",
    })

    return ok({ entry: toScheduleDTO(entry) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

function normaliseDay(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

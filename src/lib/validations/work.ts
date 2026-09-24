import { z } from "zod"

import { BLOCKER_REASONS } from "@/lib/work-constants"

import { AWAY_REASONS, TICKET_PRIORITIES } from "@/lib/work-constants"

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Pick someone from the list")

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

/** The owner's "New ticket" dialog. */
export const ticketSchema = z
  .object({
    title: z.string().trim().min(2, "Give the ticket a title").max(140),
    description: z.string().trim().max(2000).optional(),
    site: z.string().trim().min(2, "Name the site").max(160),
    lat: z.coerce
      .number<number>()
      .min(-90, "Latitude runs from -90 to 90")
      .max(90, "Latitude runs from -90 to 90"),
    lng: z.coerce
      .number<number>()
      .min(-180, "Longitude runs from -180 to 180")
      .max(180, "Longitude runs from -180 to 180"),
    radiusM: z.coerce
      .number<number>()
      .int()
      .min(10, "Use at least 10 m")
      .max(5000, "5 km is the largest fence"),
    projectId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Pick a project for this ticket"),
    startAt: z.iso.datetime({ message: "Pick a start time" }),
    endAt: z.iso.datetime({ message: "Pick an end time" }),
    assigneeIds: z
      .array(objectId)
      .min(1, "Put at least one person on this ticket")
      .max(20, "That is a lot of people for one ticket"),
    priority: z.enum(TICKET_PRIORITIES),
  })
  .refine((values) => new Date(values.endAt) > new Date(values.startAt), {
    message: "The end time has to be after the start",
    path: ["endAt"],
  })

export type TicketValues = z.infer<typeof ticketSchema>

/**
 * What the phone sends when checking in or out. Whether a reason is *required*
 * depends on the geofence, which only the server knows, so that rule lives in
 * the route rather than here.
 */
export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000).optional(),
  reason: z.string().trim().max(500).optional(),
})

export type CheckInValues = z.infer<typeof checkInSchema>

/** Status changes the assignee can make from the phone. */
export const ticketStatusSchema = z
  .object({
    status: z.enum([
      "pending",
      "in_progress",
      "in_review",
      "blocked",
      "done",
    ]),
    blockedReason: z.string().trim().max(500).optional(),
    /** Which kind of problem it is, so the owner can sort by cause. */
    blockerReason: z.enum(BLOCKER_REASONS).optional(),
    /** The longer version, for whatever the one-liner can't hold. */
    blockerNote: z
      .string()
      .trim()
      .max(800)
      .nullish()
      .transform((value) => value || undefined),
    /** What the job is short of. Only meaningful when the cause is material. */
    needs: z
      .array(
        z.object({
          name: z.string().trim().min(1, "What is short?").max(140),
          qty: z.coerce.number<number>().min(0).max(1_000_000).optional(),
          unit: z
            .string()
            .trim()
            .max(12)
            .nullish()
            .transform((value) => value || undefined),
        })
      )
      .max(15, "That is a lot of shortages")
      .optional(),
  })
  .refine(
    (values) =>
      values.status !== "blocked" ||
      (values.blockedReason && values.blockedReason.length >= 3),
    { message: "Say what you're blocked on", path: ["blockedReason"] }
  )

export type TicketStatusValues = z.infer<typeof ticketStatusSchema>

/**
 * Start / end shift, pressed by the employee. The position rides along so a
 * workspace with an office can measure the start against it; a reason is
 * required only when the server finds them outside the outer ring.
 */
export const attendanceActionSchema = z.object({
  action: z.enum(["start", "end"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).max(100_000).optional(),
  reason: z.enum(AWAY_REASONS).optional(),
  note: z.string().trim().max(500).optional(),
})

export type AttendanceActionValues = z.infer<typeof attendanceActionSchema>

const requestBase = {
  message: z.string().trim().min(3, "Add a short note").max(1000),
}

export const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("leave"),
    ...requestBase,
    startDate: dayKey,
    endDate: dayKey,
  }),
  z.object({
    kind: z.literal("advance"),
    ...requestBase,
    amount: z.coerce
      .number<number>()
      .positive("Enter an amount")
      .max(10_000_000),
  }),
  z.object({
    kind: z.literal("material"),
    ...requestBase,
    ticketId: objectId.optional(),
  }),
])

export type RequestValues = z.infer<typeof requestSchema>

/** Leave has to end on or after it starts; the union can't express that. */
export const requestSchemaChecked = requestSchema.refine(
  (values) => values.kind !== "leave" || values.endDate >= values.startDate,
  { message: "Leave has to end on or after it starts", path: ["endDate"] }
)

/** The owner's Approve / Reject. */
export const requestDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decisionNote: z.string().trim().max(500).optional(),
})

export type RequestDecisionValues = z.infer<typeof requestDecisionSchema>

/** The owner's "New project" dialog, also reachable from inside New ticket. */
export const projectSchema = z.object({
  name: z.string().trim().min(2, "Give the project a name").max(140),
  description: z.string().trim().max(2000).optional(),
  site: z.string().trim().max(160).optional(),
})

export type ProjectValues = z.infer<typeof projectSchema>

/**
 * Editing a project. Either the fields or the status moves, never both, so
 * archiving stays one click and doesn't have to resend the whole form.
 */
export const projectUpdateSchema = z.union([
  z.object({ status: z.enum(["active", "archived"]) }),
  projectSchema,
])

/**
 * What a ticket consumed.
 *
 * Whoever did the work records it, which is why an item may be named rather
 * than picked: a roll of tape bought on the way is still material the job
 * used, and refusing anything not on the shelf would just mean it goes
 * unrecorded.
 */
export const ticketMaterialsSchema = z.object({
  materials: z
    .array(
      z.object({
        itemId: z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .nullish()
          .transform((value) => value || undefined),
        name: z.string().trim().min(1, "What was used?").max(140),
        unit: z.string().trim().max(12).default("pcs"),
        qty: z.coerce
          .number<number>()
          .gt(0, "How many?")
          .max(1_000_000, "That quantity looks wrong"),
        unitCost: z.coerce
          .number<number>()
          .min(0, "A cost can't be negative")
          .max(100_000_000)
          .default(0),
      })
    )
    .max(40, "That is a lot of lines"),
})

export type TicketMaterialsValues = z.infer<typeof ticketMaterialsSchema>

import { z } from "zod"

import { TASK_PRIORITIES } from "@/lib/work-constants"

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Pick someone from the list")

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

/** The owner's "New task" dialog. */
export const taskSchema = z
  .object({
    title: z.string().trim().min(2, "Give the task a title").max(140),
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
      .regex(/^[0-9a-fA-F]{24}$/, "Pick a project for this task"),
    startAt: z.iso.datetime({ message: "Pick a start time" }),
    endAt: z.iso.datetime({ message: "Pick an end time" }),
    assigneeIds: z
      .array(objectId)
      .min(1, "Put at least one person on this task")
      .max(20, "That is a lot of people for one task"),
    priority: z.enum(TASK_PRIORITIES),
  })
  .refine((values) => new Date(values.endAt) > new Date(values.startAt), {
    message: "The end time has to be after the start",
    path: ["endAt"],
  })

export type TaskValues = z.infer<typeof taskSchema>

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
export const taskStatusSchema = z
  .object({
    status: z.enum([
      "pending",
      "in_progress",
      "in_review",
      "blocked",
      "done",
    ]),
    blockedReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (values) =>
      values.status !== "blocked" ||
      (values.blockedReason && values.blockedReason.length >= 3),
    { message: "Say what you're blocked on", path: ["blockedReason"] }
  )

export type TaskStatusValues = z.infer<typeof taskStatusSchema>

/** Start / end shift, pressed by the employee. */
export const attendanceActionSchema = z.object({
  action: z.enum(["start", "end"]),
})

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
    taskId: objectId.optional(),
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

/** The owner's "New project" dialog, also reachable from inside New task. */
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

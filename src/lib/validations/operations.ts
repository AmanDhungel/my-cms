import { z } from "zod"

import {
  OPERATION_KINDS,
  OPERATION_STATUSES,
  SCHEDULE_KINDS,
  TASK_PRIORITIES,
} from "@/lib/work-constants"

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "That isn't a valid id")

/** "HH:MM" on a 24-hour clock. */
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30")

/**
 * The New / Edit dialog behind all four kinds. No zod `.default()` anywhere —
 * it splits a schema's input and output types, which the dialogs' plain
 * `safeParse` handling would then have to paper over.
 */
export const operationSchema = z
  .object({
    kind: z.enum(OPERATION_KINDS),
    title: z.string().trim().min(2, "Give it a title").max(160),
    details: z.string().trim().max(2000).optional(),

    startAt: z.string().min(1, "Pick a date"),
    endAt: z.string().optional(),
    allDay: z.boolean(),

    status: z.enum(OPERATION_STATUSES),
    priority: z.enum(TASK_PRIORITIES),

    assigneeIds: z.array(objectId).max(20),
    customerId: z.union([z.literal(""), objectId]).optional(),
    projectId: z.union([z.literal(""), objectId]).optional(),
    location: z.string().trim().max(200).optional(),
  })
  .refine((values) => !Number.isNaN(Date.parse(values.startAt)), {
    message: "That date doesn't look right",
    path: ["startAt"],
  })
  .refine(
    (values) =>
      !values.endAt ||
      (!Number.isNaN(Date.parse(values.endAt)) &&
        Date.parse(values.endAt) > Date.parse(values.startAt)),
    { message: "The end has to come after the start", path: ["endAt"] }
  )

export type OperationValues = z.infer<typeof operationSchema>

/** Ticking one off, or putting it back. Its own route, so a row can flip. */
export const operationStatusSchema = z.object({
  status: z.enum(OPERATION_STATUSES),
})

/**
 * One rostered day. Hours are required for a working day and refused for one
 * that isn't — an "off" day with 09:00–17:00 on it would be a lie.
 */
export const scheduleSchema = z
  .object({
    userId: objectId,
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day"),
    kind: z.enum(SCHEDULE_KINDS),
    startTime: z.union([z.literal(""), clockTime]).optional(),
    endTime: z.union([z.literal(""), clockTime]).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .superRefine((values, ctx) => {
    const hours = values.kind === "off" || values.kind === "leave" ? false : true

    if (hours && !values.startTime) {
      ctx.addIssue({
        code: "custom",
        message: "A working day needs a start time",
        path: ["startTime"],
      })
    }
    if (hours && !values.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "A working day needs an end time",
        path: ["endTime"],
      })
    }
    if (
      hours &&
      values.startTime &&
      values.endTime &&
      values.endTime <= values.startTime
    ) {
      ctx.addIssue({
        code: "custom",
        message: "The end has to come after the start",
        path: ["endTime"],
      })
    }
  })

export type ScheduleValues = z.infer<typeof scheduleSchema>

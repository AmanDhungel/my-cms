import { z } from "zod"

import { MAINTENANCE_STATUSES } from "@/lib/work-constants"

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const optionalDay = dayKey.nullish().transform((value) => value || undefined)

const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((value) => value || undefined)

/** An item received for repair. */
export const maintenanceSchema = z.object({
  item: z.string().trim().min(2, "What came in?").max(140),
  makeModel: line(120),
  /**
   * Optional, because plenty of things arrive without one — but it is the
   * field that stops two identical pumps being mixed up, so the form asks
   * for it prominently.
   */
  serialNumber: line(80),

  owner: line(140),
  ownerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Pick one from the list")
    .nullish()
    .transform((value) => value || undefined),

  fault: z.string().trim().min(3, "What needs repairing?").max(1000),
  diagnosis: line(2000),

  status: z.enum(MAINTENANCE_STATUSES),
  receivedAt: dayKey,
  dueAt: optionalDay,
  returnedAt: optionalDay,

  cost: z.coerce
    .number<number>()
    .min(0, "A cost can't be negative")
    .max(100_000_000, "That cost looks wrong")
    .nullish()
    .transform((value) => (value === null ? undefined : value)),

  assigneeId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Pick one from the list")
    .nullish()
    .transform((value) => value || undefined),

  photos: z
    .array(z.string().trim().url().max(600))
    .max(8, "Eight pictures is plenty"),

  note: line(1000),
})

export type MaintenanceValues = z.infer<typeof maintenanceSchema>

import { z } from "zod"

/** The "New customer" dialog, and the same fields when editing one. */
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Give the customer a name").max(140),
  company: z.string().trim().max(140).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z
    .union([z.literal(""), z.email("That email doesn't look right")])
    .optional(),
  location: z.string().trim().max(200).optional(),
  pan: z.string().trim().max(30).optional(),
  note: z.string().trim().max(500).optional(),
})

export type CustomerValues = z.infer<typeof customerSchema>

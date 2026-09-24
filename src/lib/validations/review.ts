import { z } from "zod"

/**
 * Inviting a client to look at a quotation.
 *
 * Either an email address or a phone number — whichever you have for them.
 * Neither is verified and neither is used to send anything: EMS has no mail
 * or SMS gateway, so the owner gets a link to pass on. The address is stored
 * so the record says who it went to.
 */
export const inviteReviewSchema = z.object({
  invitedTo: z
    .string()
    .trim()
    .min(3, "An email address or a phone number")
    .max(160)
    .refine(
      (value) =>
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ||
        /^[+\d][\d\s()-]{5,}$/.test(value),
      "That doesn't look like an email address or a phone number"
    ),
  /** Days the link stays good for. */
  days: z.coerce.number<number>().int().min(1).max(90).default(30),
})

export type InviteReviewValues = z.infer<typeof inviteReviewSchema>

/**
 * What the client sends back.
 *
 * A remark, a decision, or both at once — "these two prices are too high,
 * please revise" is one action, not two, and splitting it would lose the
 * connection between the objection and the request.
 */
export const clientReviewSchema = z
  .object({
    clientName: z
      .string()
      .trim()
      .max(140)
      .nullish()
      .transform((value) => value || undefined),
    remark: z
      .string()
      .trim()
      .max(1500, "That is a very long remark")
      .nullish()
      .transform((value) => value || undefined),
    /** Which line it is about. Absent means the quotation as a whole. */
    lineIndex: z.coerce.number<number>().int().min(0).max(500).optional(),
    decision: z.enum(["approved", "changes_requested"]).optional(),
  })
  .refine((values) => values.remark || values.decision, {
    message: "Write a remark, or say whether you approve it",
    path: ["remark"],
  })

export type ClientReviewValues = z.infer<typeof clientReviewSchema>

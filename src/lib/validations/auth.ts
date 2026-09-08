import { z } from "zod"

import { isValidTimeZone } from "@/lib/time"

/** What the Credentials provider accepts. Kept loose — the DB decides. */
export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const loginSchema = z.object({
  email: z.email("Enter a valid work email"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
})

export type LoginValues = z.infer<typeof loginSchema>

export const CREW_SIZES = ["1–10", "11–50", "50+"] as const
export type CrewSize = (typeof CREW_SIZES)[number]

export const SHIFTS = [
  "08:00–17:00",
  "06:00–14:00",
  "14:00–22:00",
] as const
export type Shift = (typeof SHIFTS)[number]

/** Workspace creation. Only an owner account is made this way. */
export const signupSchema = z.object({
  business: z.string().trim().min(2, "Business name is required"),
  name: z.string().trim().min(2, "Your name is required"),
  phone: z.string().trim().min(7, "Enter a contact number"),
  email: z.email("Enter a valid work email"),
  password: z.string().min(10, "Use at least 10 characters"),
  crewSize: z.enum(CREW_SIZES),
  terms: z
    .boolean()
    .refine((accepted) => accepted, "Accept the terms to continue"),
})

export type SignupValues = z.infer<typeof signupSchema>

/** The owner's "Invite employee" dialog. */
export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Full name is required"),
  email: z.email("An email is required — it's how they sign in"),
  phone: z.string().trim().min(7, "Enter a contact number"),
  role: z.enum(["employee", "supervisor"]),
  shift: z.enum(SHIFTS),
  message: z.string().trim().max(500).optional(),
})

export type InviteValues = z.infer<typeof inviteSchema>

/** What the invitee fills in on /join/[token]. */
export const acceptInviteSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters"),
  terms: z
    .boolean()
    .refine((accepted) => accepted, "Accept the terms to continue"),
})

export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>

/** Organization settings the owner can edit. */
export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2, "Business name is required"),
  crewSize: z.enum(CREW_SIZES),
  // Attendance day boundaries and lateness are judged in this zone.
  timeZone: z
    .string()
    .refine(isValidTimeZone, "That isn't a time zone this system knows"),
})

export type BusinessSettingsValues = z.infer<typeof businessSettingsSchema>

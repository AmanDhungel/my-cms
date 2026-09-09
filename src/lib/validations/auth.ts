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

/** "HH:MM" on a 24-hour clock. */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00")

/**
 * A shift is stored as one "HH:MM–HH:MM" string, which is what the attendance
 * rules already parse. Overnight shifts aren't supported: the end has to come
 * after the start on the same day.
 */
export const shiftRange = z
  .object({ shiftStart: timeOfDay, shiftEnd: timeOfDay })
  .refine((values) => minutesOf(values.shiftEnd) > minutesOf(values.shiftStart), {
    message: "The end has to be later than the start",
    path: ["shiftEnd"],
  })

export function minutesOf(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function composeShift(start: string, end: string) {
  return `${start}–${end}`
}

/** Splits a stored shift back into its two inputs. */
export function splitShift(shift?: string | null) {
  const match = shift?.match(/^\s*(\d{2}:\d{2})\s*[–—-]\s*(\d{2}:\d{2})\s*$/)
  return match
    ? { shiftStart: match[1], shiftEnd: match[2] }
    : { shiftStart: "08:00", shiftEnd: "17:00" }
}

/** "8h 30m" — what the owner sees under the two pickers. */
export function shiftLength(start: string, end: string) {
  const total = minutesOf(end) - minutesOf(start)
  if (!Number.isFinite(total) || total <= 0) return null
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

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
  shiftStart: timeOfDay,
  shiftEnd: timeOfDay,
  message: z.string().trim().max(500).optional(),
})
  .refine((values) => minutesOf(values.shiftEnd) > minutesOf(values.shiftStart), {
    message: "The end has to be later than the start",
    path: ["shiftEnd"],
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

/** The owner editing someone's record from People. */
export const memberUpdateSchema = z.object({
  name: z.string().trim().min(2, "A name is required"),
  phone: z.string().trim().min(7, "Enter a contact number"),
  role: z.enum(["owner", "supervisor", "employee"]),
  shiftStart: timeOfDay.optional(),
  shiftEnd: timeOfDay.optional(),
})
  .refine(
    (values) =>
      !values.shiftStart ||
      !values.shiftEnd ||
      minutesOf(values.shiftEnd) > minutesOf(values.shiftStart),
    { message: "The end has to be later than the start", path: ["shiftEnd"] }
  )

export type MemberUpdateValues = z.infer<typeof memberUpdateSchema>

import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Enter a valid work email"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
})

export type LoginValues = z.infer<typeof loginSchema>

export const CREW_SIZES = ["1–10", "11–50", "50+"] as const
export type CrewSize = (typeof CREW_SIZES)[number]

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

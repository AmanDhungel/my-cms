import { z } from "zod"

import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { revokeMobileAccess } from "@/lib/auth/mobile-sessions"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { connectToDatabase } from "@/lib/mongodb"
import { enforceLimit } from "@/lib/security/rate-limit"
import { User } from "@/models/user"

export const runtime = "nodejs"

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(1024),
  newPassword: z.string().min(10, "Use at least 10 characters").max(1024),
})

/**
 * Change your own password. Every other session ends with it: web cookie
 * sessions through sessionsValidAfter (lib/auth/guards.ts), mobile tokens
 * through revokeMobileAccess — including the caller's, who signs in again.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireUser()
    await enforceLimit("password", viewer.id)
    const values = passwordChangeSchema.parse(await readJson(request))

    await connectToDatabase()
    const user = await User.findById(viewer.id).select("+passwordHash").orFail()

    if (!(await verifyPassword(values.currentPassword, user.passwordHash))) {
      throw new HttpError(422, "Validation failed", {
        currentPassword: ["That isn't your current password"],
      })
    }

    user.passwordHash = await hashPassword(values.newPassword)
    user.sessionsValidAfter = new Date()
    await user.save()
    await revokeMobileAccess([user._id])

    void logActivity({
      businessId: viewer.businessId,
      action: "password_changed",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: viewer.name,
      targetKind: "member",
      targetId: viewer.id,
      href: "/dashboard/people",
    })

    return ok({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

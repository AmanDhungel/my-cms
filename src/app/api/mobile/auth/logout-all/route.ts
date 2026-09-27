import { handleApiError, ok } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/guards"
import { revokeMobileAccess } from "@/lib/auth/mobile-sessions"

export const runtime = "nodejs"

/**
 * Sign this account out of every device: all refresh tokens are revoked and
 * the access tokens already issued stop working on their next request.
 * Web cookie sessions are left alone.
 */
export async function POST() {
  try {
    const viewer = await requireUser()
    await revokeMobileAccess([viewer.id])
    return ok({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

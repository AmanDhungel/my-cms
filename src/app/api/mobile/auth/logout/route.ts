import { z } from "zod"

import { handleApiError, ok, readJson } from "@/lib/api-response"
import { endMobileSession } from "@/lib/auth/mobile-sessions"

export const runtime = "nodejs"

const logoutSchema = z.object({ refreshToken: z.string().min(1).max(200) })

/**
 * Revoke this device's refresh token. Holding the token is the credential;
 * the answer is the same whether it was live, spent or never existed.
 * The access token already issued lapses on its own within 15 minutes.
 */
export async function POST(request: Request) {
  try {
    const { refreshToken } = logoutSchema.parse(await readJson(request))
    await endMobileSession(refreshToken)
    return ok({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

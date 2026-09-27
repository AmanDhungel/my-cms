import { z } from "zod"

import { fail, handleApiError, ok, readJson } from "@/lib/api-response"
import { rotateMobileSession } from "@/lib/auth/mobile-sessions"

export const runtime = "nodejs"

const refreshSchema = z.object({ refreshToken: z.string().min(16).max(200) })

/**
 * Trade a refresh token for a new pair. The old one stops working at once;
 * presenting it again revokes every token in its family.
 */
export async function POST(request: Request) {
  try {
    const { refreshToken } = refreshSchema.parse(await readJson(request))
    const tokens = await rotateMobileSession(refreshToken)
    if (!tokens) return fail("Sign in to continue", 401)
    return ok(tokens)
  } catch (error) {
    return handleApiError(error)
  }
}

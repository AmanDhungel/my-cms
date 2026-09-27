import { z } from "zod"

import { fail, handleApiError, ok, readJson } from "@/lib/api-response"
import { auditLogin, findLoginAccount } from "@/lib/auth/login-audit"
import { startMobileSession } from "@/lib/auth/mobile-sessions"
import { verifyCredentials } from "@/lib/auth/verify-credentials"
import { buildMe } from "@/lib/me"
import { clientIp } from "@/lib/security/client-ip"
import { limitBy, tooManyMessage } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

/** What the web's login form says for every refusal (src/components/auth/login-form.tsx). */
const LOGIN_REFUSED = "Email or password is incorrect"

/** Strings only: an object such as {"$ne": null} is refused before any query. */
const mobileLoginSchema = z.object({
  email: z.string().max(320),
  password: z.string().max(1024),
  deviceName: z.string().trim().max(120).optional(),
})

/**
 * Mobile sign-in. The same password check as the web (lib/auth/
 * verify-credentials.ts), the same limits — 5 per email and 20 per IP per
 * 15 minutes — and the same audit trail; one uniform refusal for a wrong
 * password, an unknown email, a removed or blocked account and a blocked
 * workspace alike.
 */
export async function POST(request: Request) {
  try {
    const values = mobileLoginSchema.parse(await readJson(request))
    const email = values.email.trim().toLowerCase()

    const [byEmail, byIp] = await Promise.all([
      limitBy("loginEmail", email),
      limitBy("loginIp", clientIp(request.headers)),
    ])
    const account = await findLoginAccount(email)

    if (!byEmail.ok || !byIp.ok) {
      const retryAfter = Math.max(byEmail.ok ? 0 : byEmail.retryAfter, byIp.ok ? 0 : byIp.retryAfter)
      if (account) void auditLogin(account, "login_rate_limited")
      return fail(tooManyMessage(retryAfter), 429, undefined, { "Retry-After": String(retryAfter) })
    }

    const identity = await verifyCredentials({ email: values.email, password: values.password })
    if (!identity) {
      if (account) void auditLogin(account, "login_failed")
      return fail(LOGIN_REFUSED, 401)
    }

    const tokens = await startMobileSession(identity, values.deviceName)
    const user = await buildMe({
      id: identity.id,
      name: identity.name,
      email: identity.email,
      role: identity.role,
      businessId: identity.businessId,
    })
    if (account) void auditLogin(account, "login_succeeded")

    return ok({ ...tokens, user })
  } catch (error) {
    return handleApiError(error)
  }
}

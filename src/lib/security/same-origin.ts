/**
 * CSRF defence for state-changing requests: a POST / PUT / PATCH / DELETE
 * must say it came from this app's own origin, through Origin (or, when a
 * browser leaves Origin off, Referer). A request that names another origin,
 * or neither, is refused. The session cookie is SameSite=Lax as well; this is
 * the second, independent check.
 *
 * Edge-safe (string handling only), because the proxy runs it too.
 */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

export function isMutating(method: string) {
  return MUTATING.has(method.toUpperCase())
}

/** The host the request was addressed to, as the browser saw it. */
function requestHost(headers: Headers) {
  return (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").toLowerCase()
}

export function isSameOrigin(method: string, headers: Headers): boolean {
  if (!isMutating(method)) return true
  const host = requestHost(headers)
  const source = headers.get("origin") ?? headers.get("referer")
  if (!source || source === "null" || !host) return false
  try {
    return new URL(source).host.toLowerCase() === host
  } catch {
    return false
  }
}

export const CROSS_ORIGIN_MESSAGE = "Cross-origin requests aren't allowed"

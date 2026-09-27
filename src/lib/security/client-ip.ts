/**
 * The client's IP address, for per-IP rate limits.
 *
 * Next.js gives application code no socket address: its server fills in
 * `x-forwarded-for` from the socket only when the header is absent. So:
 *
 * - With TRUST_PROXY set (a reverse proxy in front that overwrites
 *   X-Forwarded-For), the first entry is the client the proxy saw.
 * - Without it, the last entry is used — the socket address when the
 *   client sent no header. A client that sends its own header can choose
 *   this value, so per-IP limits are best-effort there; the per-email and
 *   per-user limits never depend on it.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean)
    const pick = process.env.TRUST_PROXY ? parts[0] : parts[parts.length - 1]
    if (pick) return pick
  }
  return headers.get("x-real-ip")?.trim() || "unknown"
}

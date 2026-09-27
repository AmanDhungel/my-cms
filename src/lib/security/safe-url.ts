/**
 * URLs that came from a user, made safe before they are stored or rendered.
 *
 * Links and pictures accept absolute http(s) only: javascript:, data:,
 * vbscript:, protocol-relative (//host) and anything unparsable are refused
 * by the Zod schemas (422) and, for anything already stored, not rendered.
 * tel: and mailto: are never taken from input; they are built here from a
 * validated phone number or email address.
 *
 * Client-safe: the renderers use the same checks as the API. The Zod schema
 * lives in safe-url-schema.ts, so pages that only render links don't ship Zod.
 */

/** Absolute http(s) with a host, and nothing a browser would reinterpret. */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  // Control characters and backslashes are how "java\tscript:" and "/\\evil"
  // tricks slip past naive checks.
  if (!trimmed || /[\u0000-\u001f\u007f\\]/.test(trimmed)) return false
  if (trimmed.startsWith("//")) return false
  try {
    const url = new URL(trimmed)
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname)
  } catch {
    return false
  }
}

/** A link target to render, or null to render no link at all. */
export function safeHref(value: unknown): string | null {
  return isSafeHttpUrl(value) ? value.trim() : null
}

/** An <img src>: http(s), a same-site path, or a local blob: preview. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const trimmed = value.trim()
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) return trimmed
  if (trimmed.startsWith("blob:")) return trimmed
  return isSafeHttpUrl(trimmed) ? trimmed : null
}

/** tel: from a phone number: digits, one leading +, nothing else survives. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "")
  return /\d{3,}/.test(digits) ? `tel:${digits}` : null
}

/** mailto: from an address that looks like one, or null. */
export function mailtoHref(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim()
  return /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(trimmed)
    ? `mailto:${trimmed}`
    : null
}

/**
 * A post-login destination: a same-origin relative path only. Absolute URLs,
 * protocol-relative ones and backslash tricks fall back to `fallback`.
 */
export function safeCallbackPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) return fallback
  return trimmed
}

export const UNSAFE_URL_MESSAGE = "Use a web address starting with https://"


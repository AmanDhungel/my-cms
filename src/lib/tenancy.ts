/**
 * Which workspace a request belongs to, worked out from its host.
 *
 * Deliberately dependency-free: `proxy.ts` imports this and runs on the edge
 * for every request, so nothing here may reach for mongoose, node APIs or the
 * database. It is string handling and a word list, nothing more.
 */

/**
 * The domain the sites hang off. In development that is `localhost`, which
 * browsers already resolve for any subdomain — `balaju.localhost:3000` works
 * with no hosts file and no DNS.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost"

/**
 * Subdomains the platform keeps for itself.
 *
 * A workspace calling itself "admin" or "api" would otherwise shadow a real
 * part of the product, and one calling itself "www" would be unreachable.
 */
export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "login",
  "signup",
  "join",
  "auth",
  "static",
  "assets",
  "cdn",
  "mail",
  "ftp",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "sites",
  "site",
  "test",
  "staging",
  "dev",
  "demo",
  "ems",
])

/** Lower case, letters, digits and single hyphens, 3–40 characters. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

export function isValidSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug)
}

/**
 * A workspace name turned into something that can live in a hostname.
 *
 * Only a suggestion — the owner can type their own — so it aims to be
 * recognisable rather than clever.
 */
export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    // Anything that isn't a letter or a digit becomes a break.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")

  // A hostname label cannot be one character, and must not be a reserved word.
  if (base.length < 3) return `${base || "site"}-site`.slice(0, 40)
  return RESERVED_SLUGS.has(base) ? `${base}-site`.slice(0, 40) : base
}

/**
 * The slug a request is for, or null when it is the platform itself.
 *
 * The port is dropped first: `balaju.localhost:3000` and `balaju.localhost`
 * are the same tenant, and only one of them is what a browser sends.
 */
export function tenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null

  const name = host.split(":")[0].toLowerCase().trim()
  if (!name || name === ROOT_DOMAIN) return null

  // A bare IP has no subdomain to read, whatever its shape.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return null

  const suffix = `.${ROOT_DOMAIN}`
  if (!name.endsWith(suffix)) return null

  const label = name.slice(0, -suffix.length)
  // Only one level deep. `a.b.example.com` is not a tenant called "a.b".
  if (!label || label.includes(".")) return null
  if (RESERVED_SLUGS.has(label)) return null

  return label
}

/** Where a published site lives, for links and for the copy-to-clipboard. */
export function siteHostFor(slug: string, port?: string | number | null) {
  const host = `${slug}.${ROOT_DOMAIN}`
  return port ? `${host}:${port}` : host
}

export function siteUrlFor(slug: string, port?: string | number | null) {
  // Plain http on localhost: a dev machine has no certificate for it.
  const scheme = ROOT_DOMAIN === "localhost" ? "http" : "https"
  return `${scheme}://${siteHostFor(slug, port)}`
}

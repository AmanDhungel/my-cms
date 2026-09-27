/**
 * Addresses of stored pictures: which ones are ours, the key behind them,
 * and the address they are served from today.
 *
 * Pure string work with no AWS SDK, so the DTO layer (which a client
 * component may import for a type or a helper) can use it safely. Outside
 * the server the AWS_* variables are absent, and every function here then
 * leaves an address exactly as it was.
 *
 * Two buckets count as ours: AWS_BUCKET_NAME, where every new upload goes,
 * and AWS_LEGACY_BUCKET_NAME, the one pictures lived in before the move to
 * a private bucket behind CloudFront. Old links into either still resolve
 * to a key, so ownership and delete checks keep working on them.
 */

/**
 * S3's own hostnames, with and without a region, in the dotted, the older
 * dashed and the dual-stack spellings: s3.amazonaws.com,
 * s3.eu-north-1.amazonaws.com, s3-eu-north-1.amazonaws.com,
 * s3.dualstack.eu-north-1.amazonaws.com.
 */
const S3_HOST = /^s3(?:[.-](?:dualstack\.)?[a-z0-9-]+)?\.amazonaws\.com$/

/** The buckets whose addresses are ours: the current one, then the old one. */
function ourBuckets(): string[] {
  return [process.env.AWS_BUCKET_NAME, process.env.AWS_LEGACY_BUCKET_NAME]
    .map((name) => (name ?? "").trim().toLowerCase())
    .filter((name, index, all) => name && all.indexOf(name) === index)
}

/**
 * Where a stored object is read from.
 *
 * The CDN (AWS_PUBLIC_BASE_URL) when one is configured — the bucket itself
 * is private and only CloudFront may read it. Without one, the plain bucket
 * URL, for a deployment that still serves from a public bucket.
 */
export function publicUrlFor(key: string) {
  const base = process.env.AWS_PUBLIC_BASE_URL?.replace(/\/+$/, "")
  if (base) return `${base}/${key}`
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

/**
 * What an address points at, as far as our storage is concerned.
 *
 * - "bucket": it reaches an object in one of our buckets, and `key` is that
 *   object.
 * - "invalid": it reaches our storage (or can't even be read as an address)
 *   but no key can be read from it — a bad percent-escape, no path. Callers
 *   refuse it: it is ours in form and unreadable in content.
 * - "external": a genuinely different host. Nothing we store or delete.
 */
export type StorageAddress =
  | { kind: "bucket"; key: string }
  | { kind: "invalid" }
  | { kind: "external" }

/**
 * Read any form of an address into our storage down to its object key.
 *
 * Every question about "is this one of our files, and whose" goes through
 * here, so the site save, maintenance, the uploads DELETE and deleteUploads
 * cannot disagree about which addresses count. It recognises:
 *   - AWS_PUBLIC_BASE_URL (the CloudFront domain), when set
 *   - virtual-hosted: <bucket>.s3[.<region>].amazonaws.com/<key>
 *   - path-style:     s3[.<region>].amazonaws.com/<bucket>/<key>
 * for both the current and the legacy bucket, with the host compared
 * case-insensitively, the query and fragment ignored, and the path
 * percent-decoded — a malformed escape is "invalid", never a thrown error.
 * Any region counts: bucket names are global.
 */
export function classifyUrl(url: string): StorageAddress {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: "invalid" }
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { kind: "external" }
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  // The path as S3 will read it: escapes decoded. WHATWG URL parsing has
  // already resolved any `.`/`..` segments, the same way a browser would.
  let path: string
  try {
    path = decodeURIComponent(parsed.pathname)
  } catch {
    path = "\u0000"
  }

  const keyAfter = (prefix: string): StorageAddress => {
    if (path === "\u0000") return { kind: "invalid" }
    const key = path.slice(prefix.length)
    return key ? { kind: "bucket", key } : { kind: "invalid" }
  }

  const base = process.env.AWS_PUBLIC_BASE_URL?.trim()
  if (base) {
    try {
      const configured = new URL(base)
      const basePath = configured.pathname.replace(/\/+$/, "")
      if (
        configured.host.toLowerCase() === parsed.host.toLowerCase() &&
        (path === "\u0000" || path.startsWith(`${basePath}/`))
      ) {
        return keyAfter(`${basePath}/`)
      }
    } catch {
      // A misconfigured base is simply not a form an address can take.
    }
  }

  const buckets = ourBuckets()
  for (const bucket of buckets) {
    if (host.startsWith(`${bucket}.`) && S3_HOST.test(host.slice(bucket.length + 1))) {
      return keyAfter("/")
    }
  }
  if (buckets.length > 0 && S3_HOST.test(host)) {
    if (path === "\u0000") return { kind: "invalid" }
    for (const bucket of buckets) {
      if (path.startsWith(`/${bucket}/`)) return keyAfter(`/${bucket}/`)
    }
    // Another bucket on S3 is someone else's storage, not ours.
    return { kind: "external" }
  }

  return { kind: "external" }
}

/**
 * The object key behind one of our URLs, or null if it isn't one of ours.
 *
 * Both layouts come back intact:
 *   <any form>/businesses/<id>/site/<uuid>.jpg  ->  businesses/<id>/site/<uuid>.jpg
 *   <any form>/site/<id>/<uuid>.jpg             ->  site/<id>/<uuid>.jpg
 * An external address, and one into our storage that can't be read, are both
 * null here; a caller that must tell them apart uses `classifyUrl`.
 */
export function keyFromUrl(url: string): string | null {
  const address = classifyUrl(url)
  return address.kind === "bucket" ? address.key : null
}

/**
 * The address a stored picture is served from now.
 *
 * Any address into our storage — an old public-bucket link included — comes
 * back as `publicUrlFor(key)`; anything else (an external picture, an empty
 * string) is returned untouched. Used on the way out of the DTO layer, and
 * wherever a stored address is compared with one a client sent back, so the
 * two spellings of one object are never mistaken for different pictures.
 */
export function servedUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url
  const key = keyFromUrl(url)
  return (key ? publicUrlFor(key) : url) as T
}

import { servedUrl } from "@/lib/storage/urls"

/**
 * Who added each picture, for records whose pictures are plain URL strings
 * (maintenance photos, site content). The record keeps a side list of
 * { url, uploadedBy, uploadedAt }, maintained by the server on every save.
 */
export type Uploader = { url: string; uploadedBy?: unknown; uploadedAt?: Date | null }

/**
 * The side list for a record's new pictures: a picture that was already
 * there keeps its entry; a new one is credited to whoever is saving.
 * Pictures without an entry (saved before tracking) stay without one.
 */
export function nextUploaders(
  urls: readonly string[],
  before: readonly string[],
  existing: readonly Uploader[],
  viewerId: string
) {
  // Compared as served: an old bucket link and its CDN address are one picture.
  const stored = new Map(existing.map((one) => [servedUrl(one.url), one]))
  const had = new Set(before.map(servedUrl))
  const out: { url: string; uploadedBy: string; uploadedAt: Date }[] = []
  for (const url of new Set(urls)) {
    const kept = stored.get(servedUrl(url))
    if (kept?.uploadedBy) {
      out.push({ url, uploadedBy: String(kept.uploadedBy), uploadedAt: kept.uploadedAt ?? new Date() })
    } else if (!had.has(servedUrl(url))) {
      out.push({ url, uploadedBy: viewerId, uploadedAt: new Date() })
    }
  }
  return out
}

/** The pictures a save drops, each with its recorded uploader (or none). */
export function removedPictures(
  before: readonly string[],
  after: readonly string[],
  existing: readonly Uploader[]
) {
  const keep = new Set(after.map(servedUrl))
  const stored = new Map(existing.map((one) => [servedUrl(one.url), one]))
  return [...new Set(before)]
    .filter((url) => url && !keep.has(servedUrl(url)))
    .map((url) => {
      const by = stored.get(servedUrl(url))?.uploadedBy
      return { url, uploadedBy: by ? String(by) : null }
    })
}

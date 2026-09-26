import { HttpError } from "@/lib/api-response"
import { isBusinessKey, keyFromUrl } from "@/lib/s3"
import { InventoryItem } from "@/models/inventory-item"

/**
 * Matches one exact string, ignoring case, so "Cables" and "cables" are
 * treated as the same name. The unique indexes are case-sensitive; this is
 * what turns a near-duplicate into a clear message instead of a second row.
 */
export function sameText(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped}$`, "i")
}

/**
 * Item names and codes are unique per workspace. Checking here rather than
 * letting the index throw is what makes the message name the item you already
 * have, instead of the raw key that collided.
 */
export async function assertItemIsNew(
  businessId: string,
  name: string,
  sku?: string,
  exceptId?: string
) {
  const not = exceptId ? { _id: { $ne: exceptId } } : {}

  const byName = await InventoryItem.findOne({
    ...not,
    business: businessId,
    name: sameText(name),
  })

  if (byName) throw new HttpError(409, `${byName.name} is already on the list`)

  if (!sku) return

  const bySku = await InventoryItem.findOne({
    ...not,
    business: businessId,
    sku: sameText(sku),
  })

  if (bySku) throw new HttpError(409, `${bySku.name} already uses code ${sku}`)
}

/**
 * Turn the picture URLs a form sent into what an item stores.
 *
 * The cap is checked here as well as in the schema, so no route that skips
 * the schema can store a fourth. Each key is derived from its URL and has to
 * sit under this workspace's own prefix: an item can only ever point at a
 * picture this business uploaded, never at any address on the internet.
 */
export function itemImagesFrom(
  images: { url: string }[],
  businessId: string
): { key: string; url: string }[] {
  if (images.length > 3) {
    throw new HttpError(400, "Three pictures is the most an item can hold")
  }

  return images.map(({ url }) => {
    const key = keyFromUrl(url)
    if (!key || !isBusinessKey(key, businessId)) {
      throw new HttpError(400, "That picture isn't one of ours")
    }
    return { key, url }
  })
}

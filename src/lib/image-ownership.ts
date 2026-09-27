import { servedUrl } from "@/lib/s3"
import { isPastTicket } from "@/lib/ticket-window"
import { Business } from "@/models/business"
import { InventoryItem } from "@/models/inventory-item"
import { MaintenanceItem } from "@/models/maintenance"
import { Site } from "@/models/site"
import { Ticket } from "@/models/ticket"

/**
 * Every saved record in a workspace that points at a stored picture, with
 * who is recorded as having added it there. Used to decide whether a
 * non-owner may delete the object (lib/auth/permissions.ts).
 */
export type ImageReference = {
  kind: "ticket" | "item" | "maintenance" | "logo" | "site"
  uploadedBy: string | null
  onPastTicket?: boolean
}

export async function referencesOf(
  key: string,
  url: string,
  businessId: string,
  timeZone: string
): Promise<ImageReference[]> {
  // Any stored spelling of this object: its CDN address, or an old bucket
  // link in whatever form it was saved. Keys are unique paths, so an address
  // ending in /<key> is this object.
  const anyForm = new RegExp(`/${escapeRegExp(key)}$`)
  const served = servedUrl(url)
  const [tickets, items, maintenance, business, site] = await Promise.all([
    Ticket.find({ business: businessId, "photos.key": key }).select("photos status startAt endAt"),
    InventoryItem.find({ business: businessId, "images.key": key }).select("images"),
    MaintenanceItem.find({ business: businessId, photos: anyForm }).select("photoUploaders"),
    Business.findOne({ _id: businessId, "logo.key": key }).select("logo"),
    Site.findOne({
      business: businessId,
      $or: [
        { "content.hero.image": anyForm },
        { "content.about.image": anyForm },
        { "content.products.image": anyForm },
        { "content.gallery.url": anyForm },
      ],
    }).select("siteImageUploaders"),
  ])

  const refs: ImageReference[] = []
  const now = new Date()
  for (const ticket of tickets) {
    const photo = (ticket.photos ?? []).find((one) => one.key === key)
    refs.push({
      kind: "ticket",
      uploadedBy: photo?.uploadedBy ? String(photo.uploadedBy) : null,
      onPastTicket: isPastTicket(ticket, now, timeZone),
    })
  }
  for (const item of items) {
    const image = (item.images ?? []).find((one) => one.key === key)
    refs.push({ kind: "item", uploadedBy: image?.uploadedBy ? String(image.uploadedBy) : null })
  }
  for (const row of maintenance) {
    const entry = (row.photoUploaders ?? []).find((one) => servedUrl(one.url) === served)
    refs.push({ kind: "maintenance", uploadedBy: entry ? String(entry.uploadedBy) : null })
  }
  if (business?.logo) {
    refs.push({ kind: "logo", uploadedBy: business.logo.uploadedBy ? String(business.logo.uploadedBy) : null })
  }
  if (site) {
    const entry = (site.siteImageUploaders ?? []).find((one) => servedUrl(one.url) === served)
    refs.push({ kind: "site", uploadedBy: entry ? String(entry.uploadedBy) : null })
  }
  return refs
}

/** A literal string, safe to place inside a regular expression. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`)
}

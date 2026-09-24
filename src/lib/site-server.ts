import { connectToDatabase } from "@/lib/mongodb"
import { DEFAULT_TEMPLATE } from "@/lib/site-templates"
import { isValidSlug, slugify } from "@/lib/tenancy"
import { Business } from "@/models/business"
import { Site, type SiteContent, type SiteDocument } from "@/models/site"
import type { HydratedDocument } from "mongoose"

/**
 * Reading and starting a workspace's site.
 *
 * Every workspace has one, created on first visit rather than at signup: a
 * business that never opens the builder should not be holding an empty
 * document, and an empty document is not a site.
 */

/**
 * A free subdomain near the one asked for.
 *
 * Tried in order — `balaju`, then `balaju-2` — because a business whose name
 * is already taken would rather be `balaju-2` than `balaju-x7f3`. Bounded, so
 * a pathological name can't spin here.
 */
async function freeSlug(wanted: string) {
  const base = isValidSlug(wanted) ? wanted : slugify(wanted)

  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`.slice(0, 40)
    if (!isValidSlug(candidate)) continue
    const taken = await Site.exists({ slug: candidate })
    if (!taken) return candidate
  }

  // Fifty names in a row were taken, which in practice means the base is a
  // very popular word. A random tail always terminates.
  return `${base.slice(0, 33)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * The workspace's site, started if this is the first time anyone looked.
 *
 * The draft is seeded from what the workspace already knows about itself —
 * its name, and its address if the office is set — so the builder opens on
 * something rather than on a wall of empty boxes.
 */
export async function loadOrStartSite(
  businessId: string
): Promise<HydratedDocument<SiteDocument>> {
  await connectToDatabase()

  const existing = await Site.findOne({ business: businessId })
  if (existing) return existing

  const business = await Business.findById(businessId).orFail()
  const slug = await freeSlug(business.name)

  return Site.create({
    business: businessId,
    slug,
    template: DEFAULT_TEMPLATE,
    published: false,
    content: {
      name: business.name,
      hero: { headline: business.name },
      about: {},
      services: [],
      products: [],
      gallery: [],
      faq: [],
      contact: {
        address: business.office?.label ?? undefined,
      },
    },
  })
}

/**
 * A site by its subdomain, for a stranger.
 *
 * Unpublished sites and blocked workspaces are both invisible here, and both
 * come back the same way — as nothing at all. A subdomain that exists but
 * isn't ready should not advertise the difference.
 */
export async function findPublishedSite(slug: string) {
  await connectToDatabase()

  const site = await Site.findOne({ slug, published: true })
  if (!site) return null

  const business = await Business.findById(site.business).select("name blockedAt")
  if (!business || business.blockedAt) return null

  return site
}

/** Whether a subdomain is free for this workspace to take. */
export async function slugIsFree(slug: string, forBusinessId: string) {
  await connectToDatabase()
  const holder = await Site.findOne({ slug }).select("business")
  return !holder || String(holder.business) === String(forBusinessId)
}

/**
 * Every picture a site points at.
 *
 * Used either side of a save to work out which files are no longer referenced
 * and can be removed from storage.
 */
export function picturesIn(content: SiteContent): string[] {
  return [
    content.hero.image,
    content.about.image,
    ...content.products.map((one) => one.image),
    ...content.gallery.map((one) => one.url),
  ].filter((url): url is string => Boolean(url))
}

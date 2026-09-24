import { logActivity } from "@/lib/activity"
import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { reconcileUploads, uploadsConfigured } from "@/lib/s3"
import { loadOrStartSite, picturesIn, slugIsFree } from "@/lib/site-server"
import { siteSchema } from "@/lib/validations/site"
import { toSiteContent, toSiteDTO } from "@/models/site"

export const runtime = "nodejs"

/**
 * The workspace's own website.
 *
 * Owner only. A supervisor runs the stock and the bills; what the business
 * says about itself in public is the owner's to write, the same rule the
 * Payments and Expenses pages keep.
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner")
    const site = await loadOrStartSite(viewer.businessId)

    return ok({
      site: toSiteDTO(site),
      // So the editor can say uploads are unavailable rather than offering a
      // button that fails.
      uploads: uploadsConfigured(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Save it.
 *
 * The whole document each time rather than a patch: the editor holds the
 * entire site in its form state, and half-applied content is how a page ends
 * up with a heading from one draft and a body from another.
 */
export async function PUT(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = siteSchema.parse(await request.json())

    await connectToDatabase()
    const site = await loadOrStartSite(viewer.businessId)

    if (values.slug !== site.slug) {
      if (!(await slugIsFree(values.slug, viewer.businessId))) {
        throw new HttpError(
          409,
          "Someone else is using that address. Try another."
        )
      }
    }

    // What it pointed at before, so whatever is dropped can be cleared out
    // of the bucket afterwards.
    const before = picturesIn(toSiteContent(site.content))

    site.slug = values.slug
    site.template = values.template
    site.set("content", values.content)
    site.updatedBy = viewer.id as never
    await site.save()

    /*
     * Tidying happens here rather than in the browser because a closed tab
     * would otherwise leave an orphan in the bucket for ever. It is not
     * awaited: a bucket that refuses a delete must not fail a save the person
     * has already made.
     */
    void reconcileUploads(before, picturesIn(toSiteContent(site.content)))

    return ok({ site: toSiteDTO(site) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Put it up, or take it down.
 *
 * Publishing is the whole deployment: the site is served from its subdomain
 * by the proxy the moment this flag is set, with no build and nothing to wait
 * for. Taking it down is the same switch the other way, and is immediate for
 * the same reason.
 */
export async function POST(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const body = (await request.json()) as { published?: unknown }

    if (typeof body.published !== "boolean") {
      throw new HttpError(400, "Say whether to publish or unpublish")
    }

    await connectToDatabase()
    const site = await loadOrStartSite(viewer.businessId)

    // A site with nothing on it is not worth a public address.
    if (body.published && !site.content?.name?.trim()) {
      throw new HttpError(400, "Give the site a business name before publishing")
    }

    site.published = body.published
    site.publishedAt = body.published ? new Date() : undefined
    site.updatedBy = viewer.id as never
    await site.save()

    void logActivity({
      businessId: viewer.businessId,
      action: body.published ? "site_published" : "site_unpublished",
      actorId: viewer.id,
      actorName: viewer.name,
      subject: site.slug,
      targetKind: "site",
      targetId: site._id,
      href: "/dashboard/site",
    })

    return ok({ site: toSiteDTO(site) })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextResponse } from "next/server"
import { Error as MongooseError } from "mongoose"

import { logActivity } from "@/lib/activity"
import { handleApiError, HttpError, ok, readJson } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import {
  foreignPictures,
  reconcileUploads,
  uploadsConfigured,
} from "@/lib/s3"
import { loadOrStartSite, picturesIn, slugIsFree } from "@/lib/site-server"
import { siteSchema } from "@/lib/validations/site"
import { Site, toSiteContent, toSiteDTO } from "@/models/site"

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
/** The answer to a save made from a version that is no longer current. */
function stale(updatedAt: Date | undefined) {
  return NextResponse.json(
    {
      error: "This site was changed in another tab.",
      code: "stale",
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
    },
    { status: 409 }
  )
}

export async function PUT(request: Request) {
  try {
    const viewer = await requireRole("owner")
    const values = siteSchema.parse(await readJson(request))

    /*
     * A picture in our bucket has to be this workspace's own site picture.
     * Anything else — another business's, or this one's logo or product
     * photos — is refused: once stored, dropping it on a later save would
     * delete an object this site never owned. An address outside the bucket
     * is left alone, as it always was; nothing here would ever delete it.
     */
    const incoming = [
      values.content.hero.image,
      values.content.about.image,
      ...values.content.products.map((one) => one.image),
      ...values.content.gallery.map((one) => one.url),
    ].filter((url): url is string => Boolean(url))
    if (foreignPictures(incoming, viewer.businessId, "site").length > 0) {
      throw new HttpError(400, "That picture isn't one of ours")
    }

    await connectToDatabase()
    const site = await loadOrStartSite(viewer.businessId)
    const loadedAt = site.updatedAt as Date | undefined

    if (values.updatedAt && loadedAt && loadedAt.toISOString() !== values.updatedAt) {
      return stale(loadedAt)
    }

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
    if (values.extraSlots) {
      site.set(
        "extraSlots",
        Object.entries(values.extraSlots).map(([id, value]) => ({ id, value }))
      )
    }
    site.updatedBy = viewer.id as never
    // The check above and this write must not be split by another save:
    // the write only matches the version that was checked.
    if (values.updatedAt && loadedAt) site.$where = { updatedAt: loadedAt }
    try {
      await site.save()
    } catch (error) {
      if (error instanceof MongooseError.DocumentNotFoundError) {
        const current = await Site.findById(site._id).select("updatedAt").lean()
        return stale(current?.updatedAt as Date | undefined)
      }
      throw error
    }

    /*
     * Tidying happens here rather than in the browser because a closed tab
     * would otherwise leave an orphan in the bucket for ever. It is not
     * awaited: a bucket that refuses a delete must not fail a save the person
     * has already made.
     */
    void reconcileUploads(
      before,
      picturesIn(toSiteContent(site.content)),
      viewer.businessId
    )

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
    const body = (await readJson(request)) as { published?: unknown }

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

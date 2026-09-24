"use client"

import {
  commitImage,
  emptyImage,
  imageSrc,
  type ImageDraft,
} from "@/lib/upload-client"
import type { SiteContent } from "@/models/site"

/**
 * The site as the editor holds it.
 *
 * Identical to the stored shape except that every picture is a draft rather
 * than a URL — a file chosen but not yet sent. The two conversions below are
 * the only places the difference exists: `toDraft` on load, `commit` on save,
 * and in between the form never has to think about uploading.
 */

export type SiteDraft = Omit<
  SiteContent,
  "hero" | "about" | "products" | "gallery"
> & {
  hero: Omit<SiteContent["hero"], "image"> & { image: ImageDraft }
  about: Omit<SiteContent["about"], "image"> & { image: ImageDraft }
  products: (Omit<SiteContent["products"][number], "image"> & {
    image: ImageDraft
  })[]
  gallery: { url: ImageDraft; caption: string | null }[]
}

export function toDraft(content: SiteContent): SiteDraft {
  return {
    ...content,
    hero: { ...content.hero, image: emptyImage(content.hero.image) },
    about: { ...content.about, image: emptyImage(content.about.image) },
    products: content.products.map((one) => ({
      ...one,
      image: emptyImage(one.image),
    })),
    gallery: content.gallery.map((one) => ({
      url: emptyImage(one.url),
      caption: one.caption,
    })),
  }
}

/**
 * Upload whatever is waiting and hand back the storable shape.
 *
 * Every picture goes through `commitImage`, which does nothing at all for one
 * that hasn't changed — so this is safe to run over the whole site on every
 * save, and only the newly chosen files cost anything.
 */
export async function commitDraft(draft: SiteDraft): Promise<SiteContent> {
  const [heroImage, aboutImage] = await Promise.all([
    commitImage(draft.hero.image, "site"),
    commitImage(draft.about.image, "site"),
  ])

  const products = []
  for (const product of draft.products) {
    products.push({ ...product, image: await commitImage(product.image, "site") })
  }

  const gallery = []
  for (const picture of draft.gallery) {
    const url = await commitImage(picture.url, "site")
    // A row whose picture never arrived is not a row.
    if (url) gallery.push({ url, caption: picture.caption })
  }

  return {
    ...draft,
    hero: { ...draft.hero, image: heroImage },
    about: { ...draft.about, image: aboutImage },
    products,
    gallery,
  }
}

/** Every picture the draft currently points at, for a dirty comparison. */
export function draftFingerprint(draft: SiteDraft) {
  return JSON.stringify({
    ...draft,
    hero: { ...draft.hero, image: stamp(draft.hero.image) },
    about: { ...draft.about, image: stamp(draft.about.image) },
    products: draft.products.map((one) => ({ ...one, image: stamp(one.image) })),
    gallery: draft.gallery.map((one) => ({
      url: stamp(one.url),
      caption: one.caption,
    })),
  })
}

/** A chosen file changes the fingerprint even before it has a URL. */
function stamp(image: ImageDraft) {
  return image.file
    ? `file:${image.file.name}:${image.file.size}:${image.file.lastModified}`
    : (image.url ?? "")
}

/**
 * The draft as the renderer wants it, for the preview.
 *
 * Pictures resolve to the local object URL when one has been chosen, so the
 * preview shows a photograph the moment it is picked rather than after the
 * save — which is the whole reason for previewing before saving.
 */
export function previewContent(draft: SiteDraft): SiteContent {
  return {
    ...draft,
    hero: { ...draft.hero, image: imageSrc(draft.hero.image) },
    about: { ...draft.about, image: imageSrc(draft.about.image) },
    products: draft.products.map((one) => ({
      ...one,
      image: imageSrc(one.image),
    })),
    gallery: draft.gallery.flatMap((one) => {
      const url = imageSrc(one.url)
      return url ? [{ url, caption: one.caption }] : []
    }),
  }
}

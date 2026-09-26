"use client"

import {
  commitImage,
  emptyImage,
  hasImage,
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
 *
 * `fresh`, when given, collects the address of every file this call
 * actually uploaded — pushed as each one lands, so it is complete even when
 * a later upload throws. Those, and only those, are what a failed save has
 * to clean up; pictures from earlier saves are never in it.
 */
export async function commitDraft(
  draft: SiteDraft,
  fresh: string[] = []
): Promise<SiteContent> {
  const commit = async (image: ImageDraft) => {
    const url = await commitImage(image, "site")
    if (image.file && url) fresh.push(url)
    return url
  }

  const heroImage = await commit(draft.hero.image)
  const aboutImage = await commit(draft.about.image)

  const products = []
  for (const product of draft.products) {
    products.push({ ...product, image: await commit(product.image) })
  }

  const gallery = []
  for (const picture of draft.gallery) {
    const url = await commit(picture.url)
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

/** Every local preview the draft holds, so they can be let go of together. */
export function draftPreviews(draft: SiteDraft): string[] {
  return [
    draft.hero.image,
    draft.about.image,
    ...draft.products.map((one) => one.image),
    ...draft.gallery.map((one) => one.url),
  ]
    .map((image) => image.preview)
    .filter((url): url is string => Boolean(url))
}

/**
 * The draft without the rows nobody filled in.
 *
 * The inline editor adds a row the moment "Add" is pressed, before anything
 * is typed into it. A row still completely empty at save time is a row that
 * was never wanted, so it is dropped rather than failing the save for a
 * missing name. A row that is half filled is kept, and the check says what
 * it is missing.
 */
export function pruneDraft(draft: SiteDraft): SiteDraft {
  const blank = (value: string | null | undefined) => !value?.trim()
  return {
    ...draft,
    services: draft.services.filter((one) => !(blank(one.title) && blank(one.body))),
    products: draft.products.filter(
      (one) =>
        !(blank(one.name) && blank(one.blurb) && blank(one.price) && !hasImage(one.image))
    ),
    faq: draft.faq.filter((one) => !(blank(one.question) && blank(one.answer))),
  }
}

/** A new, empty row for one of the lists. */
export function blankRow(list: "services" | "products" | "gallery" | "faq") {
  switch (list) {
    case "services":
      return { title: "", body: null }
    case "products":
      return { name: "", blurb: null, price: null, image: emptyImage() }
    case "gallery":
      return { url: emptyImage(), caption: null }
    case "faq":
      return { question: "", answer: "" }
  }
}

/**
 * The draft as the inline editor draws it.
 *
 * Like the preview, except that a gallery row with no picture yet is kept:
 * in the editor it is an "Add image" box waiting to be clicked, not a gap.
 */
export function editorContent(draft: SiteDraft): SiteContent {
  const view = previewContent(draft)
  return {
    ...view,
    gallery: draft.gallery.map((one) => ({
      url: imageSrc(one.url) ?? "",
      caption: one.caption,
    })),
  }
}

/**
 * The draft as it would be stored, before anything is uploaded — for checking
 * the words first, so a typo is caught without spending any bandwidth.
 * A picture waiting to upload stands in as a placeholder address.
 */
export function checkableContent(draft: SiteDraft): SiteContent {
  const pending = (image: ImageDraft) =>
    image.file ? "https://upload.pending/picture" : image.url
  return {
    ...draft,
    hero: { ...draft.hero, image: pending(draft.hero.image) },
    about: { ...draft.about, image: pending(draft.about.image) },
    products: draft.products.map((one) => ({ ...one, image: pending(one.image) })),
    gallery: draft.gallery.flatMap((one) => {
      const url = pending(one.url)
      return url ? [{ url, caption: one.caption }] : []
    }),
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

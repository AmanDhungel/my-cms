import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { DEFAULT_TEMPLATE } from "@/lib/site-templates"

/**
 * A workspace's public website.
 *
 * One per business, served from its own subdomain. The content is one shape
 * whichever template is chosen, so changing the look never costs the words —
 * a template decides which parts of this are drawn, not what may be stored.
 *
 * Images are S3 keys turned into URLs at upload time and kept here as plain
 * strings; nothing here streams a file.
 */

const linkedImage = { type: String, trim: true, maxlength: 600 }

const serviceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, trim: true, maxlength: 400 },
  },
  { _id: false }
)

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 90 },
    blurb: { type: String, trim: true, maxlength: 300 },
    /** Free text, not a number: "from Rs 2,400" is a real answer. */
    price: { type: String, trim: true, maxlength: 40 },
    image: linkedImage,
  },
  { _id: false }
)

const faqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 160 },
    answer: { type: String, required: true, trim: true, maxlength: 800 },
  },
  { _id: false }
)

const pictureSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 600 },
    caption: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
)

/**
 * One piece of template wording the owner has reworded — a section heading.
 *
 * A list of pairs rather than a Mongoose Map because slot ids have dots in
 * them ("heading.services.title"), and a Map refuses dotted keys. The API
 * and the renderer only ever see it as a plain id → text record.
 */
const extraSlotSchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { _id: false }
)

const siteSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },
    /**
     * The subdomain. Unique across the platform, because it *is* the address
     * — two workspaces cannot both be `balaju`.
     */
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
    },
    template: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      default: DEFAULT_TEMPLATE,
    },
    /**
     * Until this is set the subdomain returns a 404. A site half-written is
     * not a site anyone should be able to find.
     */
    published: { type: Boolean, required: true, default: false },
    publishedAt: { type: Date },

    content: {
      name: { type: String, required: true, trim: true, maxlength: 90 },
      tagline: { type: String, trim: true, maxlength: 140 },
      description: { type: String, trim: true, maxlength: 1200 },

      hero: {
        headline: { type: String, trim: true, maxlength: 120 },
        sub: { type: String, trim: true, maxlength: 240 },
        ctaLabel: { type: String, trim: true, maxlength: 40 },
        ctaHref: { type: String, trim: true, maxlength: 300 },
        image: linkedImage,
      },

      about: {
        title: { type: String, trim: true, maxlength: 90 },
        body: { type: String, trim: true, maxlength: 2000 },
        image: linkedImage,
      },

      services: { type: [serviceSchema], default: [] },
      products: { type: [productSchema], default: [] },
      gallery: { type: [pictureSchema], default: [] },
      faq: { type: [faqSchema], default: [] },

      contact: {
        email: { type: String, trim: true, lowercase: true, maxlength: 160 },
        phone: { type: String, trim: true, maxlength: 40 },
        address: { type: String, trim: true, maxlength: 240 },
        hours: { type: String, trim: true, maxlength: 240 },
        mapUrl: { type: String, trim: true, maxlength: 600 },
      },
    },

    /**
     * Template-only text, by slot id. Optional, and empty for every site
     * saved before the inline editor existed — which reads exactly as "use
     * the template's own wording", so no migration is needed.
     */
    extraSlots: { type: [extraSlotSchema], default: [] },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

// The lookup every tenant request makes, so it is the one that must be fast.
siteSchema.index({ slug: 1, published: 1 })

export type SiteDocument = InferSchemaType<typeof siteSchema>

export const Site: Model<SiteDocument> =
  (models.Site as Model<SiteDocument>) ??
  model<SiteDocument>("Site", siteSchema)

export type SiteContent = {
  name: string
  tagline: string | null
  description: string | null
  hero: {
    headline: string | null
    sub: string | null
    ctaLabel: string | null
    ctaHref: string | null
    image: string | null
  }
  about: { title: string | null; body: string | null; image: string | null }
  services: { title: string; body: string | null }[]
  products: {
    name: string
    blurb: string | null
    price: string | null
    image: string | null
  }[]
  gallery: { url: string; caption: string | null }[]
  faq: { question: string; answer: string }[]
  contact: {
    email: string | null
    phone: string | null
    address: string | null
    hours: string | null
    mapUrl: string | null
  }
}

export type SiteDTO = {
  id: string
  slug: string
  template: string
  published: boolean
  publishedAt: string | null
  content: SiteContent
  /** Template wording the owner has changed, by slot id. */
  extraSlots: Record<string, string>
  updatedAt: string
}

const text = (value: unknown) => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed === "" ? null : trimmed
}

/** The content, with every absent field spelled `null` rather than missing. */
export function toSiteContent(raw: SiteDocument["content"]): SiteContent {
  // Mongoose types every nested object as possibly absent. Normalising once
  // here keeps the twenty reads below from each carrying their own guard.
  const safe = (raw ?? {}) as NonNullable<SiteDocument["content"]>
  return {
    name: safe.name ?? "",
    tagline: text(safe.tagline),
    description: text(safe.description),
    hero: {
      headline: text(safe.hero?.headline),
      sub: text(safe.hero?.sub),
      ctaLabel: text(safe.hero?.ctaLabel),
      ctaHref: text(safe.hero?.ctaHref),
      image: text(safe.hero?.image),
    },
    about: {
      title: text(safe.about?.title),
      body: text(safe.about?.body),
      image: text(safe.about?.image),
    },
    services: (safe.services ?? []).map((one) => ({
      title: one.title,
      body: text(one.body),
    })),
    products: (safe.products ?? []).map((one) => ({
      name: one.name,
      blurb: text(one.blurb),
      price: text(one.price),
      image: text(one.image),
    })),
    gallery: (safe.gallery ?? []).map((one) => ({
      url: one.url,
      caption: text(one.caption),
    })),
    faq: (safe.faq ?? []).map((one) => ({
      question: one.question,
      answer: one.answer,
    })),
    contact: {
      email: text(safe.contact?.email),
      phone: text(safe.contact?.phone),
      address: text(safe.contact?.address),
      hours: text(safe.contact?.hours),
      mapUrl: text(safe.contact?.mapUrl),
    },
  }
}

/** The stored pairs as the id → text record everything else works with. */
export function toExtraSlots(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(raw)) return out
  for (const one of raw as { id?: unknown; value?: unknown }[]) {
    if (typeof one?.id === "string" && typeof one.value === "string" && one.value.trim()) {
      out[one.id] = one.value.trim()
    }
  }
  return out
}

export function toSiteDTO(site: HydratedDocument<SiteDocument>): SiteDTO {
  return {
    id: String(site._id),
    slug: site.slug,
    template: site.template,
    published: site.published,
    publishedAt: site.publishedAt
      ? (site.publishedAt as Date).toISOString()
      : null,
    content: toSiteContent(site.content),
    extraSlots: toExtraSlots(site.extraSlots),
    updatedAt: (site.updatedAt as Date).toISOString(),
  }
}

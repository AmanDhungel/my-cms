import { z } from "zod"

import { LIMITS, isKnownTemplate } from "@/lib/site-templates"
import { RESERVED_SLUGS, SLUG_PATTERN } from "@/lib/tenancy"

/**
 * An optional line of text.
 *
 * Null, undefined and "" all mean the same thing — nothing was typed — and
 * all three have to be accepted, because the site comes back from the server
 * with `null` in every empty field and the editor sends it straight back.
 * They are stored as absent, so a field typed into and then cleared reads the
 * same as one never touched.
 */
const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((value) => value || undefined)

/** An uploaded image, which is always one of ours rather than any URL. */
const imageUrl = z
  .string()
  .trim()
  .max(600)
  .url("That doesn't look like an image address")
  .nullish()
  .transform((value) => value || undefined)

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    SLUG_PATTERN,
    "Use 3–40 letters, numbers and hyphens, starting and ending with a letter or number"
  )
  .refine((value) => !RESERVED_SLUGS.has(value), {
    message: "That address is kept for the platform. Pick another.",
  })

/**
 * The ids template-only wording may be stored under: a section's heading or
 * its eyebrow line. Anything else is refused rather than stored and ignored.
 */
export const EXTRA_SLOT_PATTERN =
  /^heading\.(hero|about|services|products|gallery|faq|contact)\.(title|eyebrow)$/

const extraSlots = z
  .record(
    z.string().regex(EXTRA_SLOT_PATTERN, "That isn't a heading this site has"),
    z.string().trim().max(120, "Keep this under 120 characters")
  )
  .refine((value) => Object.keys(value).length <= 40, "Too many headings")
  // An emptied heading goes back to the template's own wording, so it is
  // dropped rather than stored blank.
  .transform((value) =>
    Object.fromEntries(Object.entries(value).filter(([, text]) => text !== ""))
  )

export const siteSchema = z.object({
  slug: slugSchema,
  template: z.string().refine(isKnownTemplate, "Pick a template from the list"),

  content: z.object({
    name: z.string().trim().min(2, "What is the business called?").max(90),
    tagline: line(140),
    description: line(1200),

    hero: z.object({
      headline: line(120),
      sub: line(240),
      ctaLabel: line(40),
      ctaHref: line(300),
      image: imageUrl,
    }),

    about: z.object({
      title: line(90),
      body: line(2000),
      image: imageUrl,
    }),

    services: z
      .array(
        z.object({
          title: z.string().trim().min(1, "Give this one a name").max(80),
          body: line(400),
        })
      )
      .max(LIMITS.services, `That is more than ${LIMITS.services} services`),

    products: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Give this one a name").max(90),
          blurb: line(300),
          // Free text on purpose: "from Rs 2,400" is a real price.
          price: line(40),
          image: imageUrl,
        })
      )
      .max(LIMITS.products, `That is more than ${LIMITS.products} products`),

    gallery: z
      .array(
        z.object({
          url: z.string().trim().url().max(600),
          caption: line(120),
        })
      )
      .max(LIMITS.gallery, `That is more than ${LIMITS.gallery} pictures`),

    faq: z
      .array(
        z.object({
          question: z.string().trim().min(1, "What is the question?").max(160),
          answer: z.string().trim().min(1, "And the answer?").max(800),
        })
      )
      .max(LIMITS.faq, `That is more than ${LIMITS.faq} questions`),

    contact: z.object({
      email: z
        .union([
          z.literal(""),
          z.null(),
          z.string().trim().email("Check that address"),
        ])
        .optional()
        .transform((value) => value || undefined),
      phone: line(40),
      address: line(240),
      hours: line(240),
      mapUrl: line(600),
    }),
  }),

  /** Optional so a client that doesn't know about it changes nothing. */
  extraSlots: extraSlots.optional(),
})

export type SiteValues = z.infer<typeof siteSchema>

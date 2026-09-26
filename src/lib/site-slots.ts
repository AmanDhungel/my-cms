import { MOCK_CONTENT } from "@/lib/site-mock"
import { layoutById, type SectionKey } from "@/lib/site-templates"
import type { SiteContent } from "@/models/site"

/**
 * Slots: every editable piece of a site, named by its path in the content.
 *
 * A slot's id is where its value lives — "hero.headline", "services.2.title",
 * "products.0.image" — so there is no second map to keep in step. Switching
 * template keeps every value because the ids don't change, and a section the
 * new template doesn't draw simply isn't shown; its content stays stored and
 * comes back when you switch again.
 *
 * Section headings are the one exception: they belong to the template rather
 * than the business, so they live in the site's `extraSlots` map under
 * "heading.<section>.title" and "heading.<section>.eyebrow", with the
 * template's own wording as the default.
 */

export const TEXT_SLOT_IDS = [
  "name",
  "tagline",
  "description",
  "hero.headline",
  "hero.sub",
  "hero.ctaLabel",
  "about.title",
  "about.body",
  "contact.phone",
  "contact.email",
  "contact.address",
  "contact.hours",
] as const

/** Values that are addresses rather than words, edited in the side panel. */
export const LINK_SLOT_IDS = ["hero.ctaHref", "contact.mapUrl"] as const

export const IMAGE_SLOT_IDS = ["hero.image", "about.image"] as const

export const LIST_SLOT_IDS = ["services", "products", "gallery", "faq"] as const
export type ListSlotId = (typeof LIST_SLOT_IDS)[number]

/** The fields an item of each list carries, text first. */
export const LIST_FIELDS: Record<ListSlotId, readonly string[]> = {
  services: ["title", "body"],
  products: ["name", "blurb", "price", "image"],
  gallery: ["url", "caption"],
  faq: ["question", "answer"],
}

/** Which section a slot belongs to, so the editor can tell what a layout draws. */
export function sectionOfSlot(id: string): SectionKey | "basics" {
  const head = id.split(".")[0]
  if (head === "heading") return (id.split(".")[1] as SectionKey) ?? "basics"
  if (
    head === "hero" ||
    head === "about" ||
    head === "services" ||
    head === "products" ||
    head === "gallery" ||
    head === "faq" ||
    head === "contact"
  ) {
    return head
  }
  return "basics"
}

/** Every slot a layout can show, derived from the sections it draws. */
export function slotsForLayout(layoutId: string): string[] {
  const sections = layoutById(layoutId)?.sections ?? []
  const ids: string[] = ["name", "tagline", "description"]
  for (const section of sections) {
    for (const id of [...TEXT_SLOT_IDS, ...LINK_SLOT_IDS, ...IMAGE_SLOT_IDS]) {
      if (sectionOfSlot(id) === section) ids.push(id)
    }
    if ((LIST_SLOT_IDS as readonly string[]).includes(section)) ids.push(section)
  }
  return [...new Set(ids)]
}

// ---- reading and writing by path -------------------------------------------

type Tree = Record<string, unknown> | unknown[]

/** The value at a dotted path, or undefined when any step is missing. */
export function getPath(root: unknown, path: string): unknown {
  let at: unknown = root
  for (const step of path.split(".")) {
    if (at === null || at === undefined || typeof at !== "object") return undefined
    at = (at as Record<string, unknown>)[step]
  }
  return at
}

/**
 * A copy of the tree with one value replaced. Only the spine of the path is
 * copied, so everything else is shared — cheap enough to run on every
 * keystroke, and it never mutates what React is holding.
 */
export function setPath<T>(root: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".")
  const node = (root ?? {}) as Tree
  const copy: Tree = Array.isArray(node) ? [...node] : { ...node }
  const key = Array.isArray(copy) ? Number(head) : head
  const child = (copy as Record<string | number, unknown>)[key]
  ;(copy as Record<string | number, unknown>)[key] =
    rest.length === 0 ? value : setPath(child, rest.join("."), value)
  return copy as T
}

// ---- samples ----------------------------------------------------------------

/** The sample text a slot shows while it is empty. */
export function mockText(id: string): string {
  const value = getPath(MOCK_CONTENT, id)
  if (typeof value === "string") return value
  // List items past the end of the sample list reuse it from the start.
  const match = /^(\w+)\.(\d+)\.(\w+)$/.exec(id)
  if (match) {
    const list = getPath(MOCK_CONTENT, match[1])
    if (Array.isArray(list) && list.length > 0) {
      const item = list[Number(match[2]) % list.length] as Record<string, unknown>
      const field = item?.[match[3]]
      if (typeof field === "string") return field
    }
  }
  return ""
}

/** The sample items a list shows while it is empty. */
export function mockList<K extends ListSlotId>(id: K): SiteContent[K] {
  return MOCK_CONTENT[id]
}

/**
 * The content as the editor or a thumbnail draws it: every empty text slot
 * filled with its sample, and every empty list with sample items, so there
 * is always something to see and click.
 *
 * Pictures are filled only for thumbnails. In the editor an empty picture
 * stays empty on purpose — it shows the "Add image" box, which is the thing
 * the owner needs to click.
 */
export function withSamples(
  content: SiteContent,
  options: { pictures: boolean }
): SiteContent {
  const text = (value: string | null, id: string) => value ?? mockText(id)
  const picture = (value: string | null, sample: string | null) =>
    value ?? (options.pictures ? sample : null)

  const fill = <K extends ListSlotId>(id: K): SiteContent[K] => {
    const items = content[id] as unknown[]
    const sample = mockList(id) as unknown[]
    const sampled = items.length === 0
    const source = sampled ? sample : items
    return source.map((raw, index) => {
      const item = raw as Record<string, unknown>
      const base = sample[index % sample.length] as Record<string, unknown>
      const out: Record<string, unknown> = { ...item }
      for (const field of LIST_FIELDS[id]) {
        const isPicture = field === "image" || field === "url"
        // Sample rows in the editor get the "Add image" box, not a sample
        // photo: the placeholder is what tells the owner to add their own.
        if (sampled && isPicture && !options.pictures) {
          out[field] = null
          continue
        }
        if (out[field] === null || out[field] === undefined || out[field] === "") {
          if (isPicture) {
            out[field] = options.pictures ? base[field] : (out[field] ?? null)
          } else {
            out[field] = base[field] ?? null
          }
        }
      }
      return out
    }) as SiteContent[K]
  }

  return {
    ...content,
    name: content.name || MOCK_CONTENT.name,
    tagline: text(content.tagline, "tagline"),
    description: text(content.description, "description"),
    hero: {
      ...content.hero,
      // The business name, not sample copy: it is what the published page
      // falls back to, so it is what the editor should show.
      headline: content.hero.headline ?? (content.name || mockText("hero.headline")),
      sub: text(content.hero.sub, "hero.sub"),
      ctaLabel: text(content.hero.ctaLabel, "hero.ctaLabel"),
      image: picture(content.hero.image, MOCK_CONTENT.hero.image),
    },
    about: {
      ...content.about,
      title: text(content.about.title, "about.title"),
      body: text(content.about.body, "about.body"),
      image: picture(content.about.image, MOCK_CONTENT.about.image),
    },
    services: fill("services"),
    products: fill("products"),
    gallery: fill("gallery"),
    faq: fill("faq"),
    contact: {
      ...content.contact,
      phone: text(content.contact.phone, "contact.phone"),
      email: text(content.contact.email, "contact.email"),
      address: text(content.contact.address, "contact.address"),
      hours: text(content.contact.hours, "contact.hours"),
    },
  }
}

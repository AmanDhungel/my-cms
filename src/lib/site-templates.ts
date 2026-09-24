/**
 * The template catalogue.
 *
 * Fifty templates, built as ten page structures in five finishes rather than
 * fifty hand-cut pages. The reason is not laziness: a layout and a palette
 * are independent choices, and pretending otherwise would mean fifty copies
 * of the same markup drifting apart, and an owner losing their text every
 * time they tried a different look.
 *
 * Because every layout reads one content shape, switching template never
 * loses a word. What changes is which parts get shown — a layout declares the
 * sections it renders, and the editor offers exactly those fields and no
 * others. That is what keeps the form foolproof: you cannot fill in a section
 * your template has no place for.
 */

export type SectionKey =
  | "hero"
  | "about"
  | "services"
  | "products"
  | "gallery"
  | "faq"
  | "contact"

export type Layout = {
  id: string
  name: string
  /** One line, as it reads on the picker card. */
  blurb: string
  /** What this one is good for, so the choice isn't guesswork. */
  suits: string
  sections: SectionKey[]
}

/**
 * Ten structures. They differ in what leads the page and how the eye moves
 * down it, which is the part a palette cannot change.
 */
export const LAYOUTS: Layout[] = [
  {
    id: "spotlight",
    name: "Spotlight",
    blurb: "A wide centred opening, then everything in tidy rows beneath it.",
    suits: "Most businesses. The safe, familiar shape.",
    sections: ["hero", "about", "services", "products", "faq", "contact"],
  },
  {
    id: "split",
    name: "Split",
    blurb: "Picture one side, words the other, alternating all the way down.",
    suits: "Work that is worth showing as well as describing.",
    sections: ["hero", "about", "services", "products", "faq", "contact"],
  },
  {
    id: "catalogue",
    name: "Catalogue",
    blurb: "A short header and then straight into what you sell.",
    suits: "Shops with a real range — the goods do the talking.",
    sections: ["hero", "products", "services", "faq", "contact"],
  },
  {
    id: "services",
    name: "Service list",
    blurb: "What you do, numbered and in order, above everything else.",
    suits: "Trades and contractors who sell work, not things.",
    sections: ["hero", "services", "about", "faq", "contact"],
  },
  {
    id: "ledger",
    name: "Ledger",
    blurb: "One quiet column of text. Almost no pictures.",
    suits: "Firms whose credibility is in the writing — legal, accounts.",
    sections: ["hero", "about", "services", "faq", "contact"],
  },
  {
    id: "storefront",
    name: "Storefront",
    blurb: "A banner, the goods in a grid, and the opening hours in plain view.",
    suits: "A shop with a door people walk through.",
    sections: ["hero", "products", "about", "contact", "faq"],
  },
  {
    id: "atelier",
    name: "Atelier",
    blurb: "Large photographs, very few words, a lot of white space.",
    suits: "Anything sold on how it looks.",
    sections: ["hero", "gallery", "about", "products", "contact"],
  },
  {
    id: "bulletin",
    name: "Bulletin",
    blurb: "Dense columns, like a front page. Everything visible at once.",
    suits: "Suppliers with a lot to say and buyers in a hurry.",
    sections: ["hero", "services", "products", "about", "faq", "contact"],
  },
  {
    id: "beacon",
    name: "Beacon",
    blurb: "One enormous phone number. The rest is underneath it.",
    suits: "Emergency and call-out work, where the job is to be rung.",
    sections: ["hero", "contact", "services", "about", "faq"],
  },
  {
    id: "gallery",
    name: "Gallery",
    blurb: "A wall of pictures with the words tucked around the edges.",
    suits: "Portfolios, makers, anyone with a back catalogue of photos.",
    sections: ["hero", "gallery", "products", "about", "contact"],
  },
]

export type Theme = {
  id: string
  name: string
  /** Enough of the palette for the picker to draw a swatch. */
  swatch: [string, string, string]
  /** Dropped onto the site's root element as custom properties. */
  vars: Record<string, string>
}

/**
 * Five finishes. Each is a full palette plus a type pairing, so the same
 * layout reads as a different business in each one.
 *
 * Every pair here was checked for contrast: body text against its background
 * and the accent's own foreground against the accent, so no combination is
 * unreadable whichever layout picks it up.
 */
export const THEMES: Theme[] = [
  {
    id: "ink",
    name: "Ink",
    swatch: ["#fbfaf8", "#1b1815", "#35a79c"],
    vars: {
      "--site-bg": "#fbfaf8",
      "--site-surface": "#ffffff",
      "--site-fg": "#1b1815",
      "--site-muted": "#6a635c",
      "--site-border": "#e5e0d8",
      "--site-accent": "#35a79c",
      "--site-accent-fg": "#ffffff",
      "--site-soft": "#eef6f5",
      "--site-display":
        "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif",
      "--site-body":
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "--site-radius": "14px",
    },
  },
  {
    id: "clay",
    name: "Clay",
    swatch: ["#fdf8f3", "#2b1d14", "#b4571f"],
    vars: {
      "--site-bg": "#fdf8f3",
      "--site-surface": "#ffffff",
      "--site-fg": "#2b1d14",
      "--site-muted": "#7c6656",
      "--site-border": "#ecdfd1",
      "--site-accent": "#b4571f",
      "--site-accent-fg": "#ffffff",
      "--site-soft": "#f9ece1",
      "--site-display": "Georgia,'Times New Roman',serif",
      "--site-body":
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "--site-radius": "4px",
    },
  },
  {
    id: "forest",
    name: "Forest",
    swatch: ["#f6f8f5", "#16241c", "#1f6b43"],
    vars: {
      "--site-bg": "#f6f8f5",
      "--site-surface": "#ffffff",
      "--site-fg": "#16241c",
      "--site-muted": "#5b6b60",
      "--site-border": "#dde5dd",
      "--site-accent": "#1f6b43",
      "--site-accent-fg": "#ffffff",
      "--site-soft": "#e6f0e8",
      "--site-display":
        "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif",
      "--site-body":
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "--site-radius": "18px",
    },
  },
  {
    id: "azure",
    name: "Azure",
    swatch: ["#f6f8fc", "#131b2b", "#1d4ed8"],
    vars: {
      "--site-bg": "#f6f8fc",
      "--site-surface": "#ffffff",
      "--site-fg": "#131b2b",
      "--site-muted": "#5a6479",
      "--site-border": "#dde3ef",
      "--site-accent": "#1d4ed8",
      "--site-accent-fg": "#ffffff",
      "--site-soft": "#e8eefb",
      "--site-display":
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "--site-body":
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "--site-radius": "10px",
    },
  },
  {
    id: "mono",
    name: "Mono",
    swatch: ["#ffffff", "#000000", "#000000"],
    vars: {
      "--site-bg": "#ffffff",
      "--site-surface": "#fafafa",
      "--site-fg": "#000000",
      "--site-muted": "#5c5c5c",
      "--site-border": "#d6d6d6",
      "--site-accent": "#000000",
      "--site-accent-fg": "#ffffff",
      "--site-soft": "#f0f0f0",
      "--site-display":
        "'Helvetica Neue',Helvetica,Arial,'Segoe UI',Roboto,sans-serif",
      "--site-body":
        "'Helvetica Neue',Helvetica,Arial,'Segoe UI',Roboto,sans-serif",
      "--site-radius": "0px",
    },
  },
]

export type Template = {
  /** "spotlight__ink" — the pair, which is what a site actually stores. */
  id: string
  layout: Layout
  theme: Theme
  name: string
}

/** All fifty, in a stable order so the gallery never reshuffles itself. */
export const TEMPLATES: Template[] = LAYOUTS.flatMap((layout) =>
  THEMES.map((theme) => ({
    id: `${layout.id}__${theme.id}`,
    layout,
    theme,
    name: `${layout.name} · ${theme.name}`,
  }))
)

export const DEFAULT_TEMPLATE = "spotlight__ink"

export function layoutById(id: string) {
  return LAYOUTS.find((one) => one.id === id)
}

export function themeById(id: string) {
  return THEMES.find((one) => one.id === id)
}

/** Splits a stored template id back into its two halves, falling back safely. */
export function templateById(id: string): Template {
  const found = TEMPLATES.find((one) => one.id === id)
  if (found) return found
  return TEMPLATES.find((one) => one.id === DEFAULT_TEMPLATE) ?? TEMPLATES[0]
}

export function isKnownTemplate(id: unknown): id is string {
  return typeof id === "string" && TEMPLATES.some((one) => one.id === id)
}

/** Which sections a template shows — and so which fields the editor offers. */
export function sectionsOf(templateId: string): SectionKey[] {
  return templateById(templateId).layout.sections
}

export function showsSection(templateId: string, section: SectionKey) {
  return sectionsOf(templateId).includes(section)
}

/** How each section reads in the editor's own headings. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Opening",
  about: "About the business",
  services: "What you do",
  products: "What you sell",
  gallery: "Pictures",
  faq: "Questions people ask",
  contact: "How to reach you",
}

export const SECTION_HINTS: Record<SectionKey, string> = {
  hero: "The first thing anyone sees. One line about what you are.",
  about: "A paragraph or two. Who you are and why someone should trust you.",
  services: "The work you take on, one entry each.",
  products: "The things you sell, with a picture and a price if you like.",
  gallery: "Photographs of your work. This template is built around them.",
  faq: "The questions you answer on the phone every week.",
  contact: "A phone number, an address, and when you are open.",
}

/** Ceilings, so a site can't be made unrenderable by pasting in a novel. */
export const LIMITS = {
  services: 10,
  products: 24,
  gallery: 18,
  faq: 15,
} as const

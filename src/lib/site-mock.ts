import type { SiteContent } from "@/models/site"

/**
 * Sample content for templates that nobody has filled in yet.
 *
 * Shown in exactly two places — the gallery's thumbnails and the editor's
 * empty slots — and never on a preview or a published site, where an empty
 * slot is left out instead. Nothing here is ever saved: the site schema only
 * accepts absolute image URLs, so these relative paths could not be stored
 * even by accident.
 */

/**
 * The pictures the templates are dressed in.
 *
 * To add more, drop the files into public/templateimg/ and list them here —
 * nothing else needs to change. Every image slot takes the next one in turn,
 * so a longer list simply means fewer repeats.
 */
export const MOCK_IMAGES: string[] = [
  "/templateimg/bannerimg.avif",
  "/templateimg/400x400img.jpeg",
]

/** The sample picture for the n-th image slot, cycling through the list. */
export function mockImage(index: number) {
  if (MOCK_IMAGES.length === 0) return null
  return MOCK_IMAGES[index % MOCK_IMAGES.length]
}

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
const LOREM_SHORT = "Lorem ipsum dolor sit amet, consectetur adipiscing."

/** A believable business, so a template reads as a real site at a glance. */
export const MOCK_CONTENT: SiteContent = {
  name: "Balaju Electricals",
  tagline: "Wiring and repairs since 2009",
  description: `${LOREM} Ut enim ad minim veniam, quis nostrud exercitation.`,
  hero: {
    headline: "Wiring done properly, first time",
    sub: "Houses, shops and small factories across the valley. Lorem ipsum dolor sit amet.",
    ctaLabel: "Call us today",
    ctaHref: null,
    image: mockImage(0),
  },
  about: {
    title: "Who we are",
    body: `${LOREM}\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`,
    image: mockImage(1),
  },
  services: [
    { title: "House rewiring", body: LOREM_SHORT },
    { title: "Fault finding", body: LOREM_SHORT },
    { title: "Solar & inverter", body: LOREM_SHORT },
    { title: "Shop fit-outs", body: LOREM_SHORT },
    { title: "Safety checks", body: LOREM_SHORT },
    { title: "Emergency call-outs", body: LOREM_SHORT },
  ],
  products: [
    { name: "2.5mm copper cable", blurb: LOREM_SHORT, price: "Rs 2,400", image: mockImage(1) },
    { name: "LED panel light", blurb: LOREM_SHORT, price: "Rs 1,150", image: mockImage(0) },
    { name: "Distribution board", blurb: LOREM_SHORT, price: "Rs 6,800", image: mockImage(1) },
    { name: "Modular switch set", blurb: LOREM_SHORT, price: "Rs 890", image: mockImage(0) },
  ],
  gallery: [
    { url: mockImage(1) ?? "", caption: "Lorem ipsum" },
    { url: mockImage(0) ?? "", caption: "Dolor sit amet" },
    { url: mockImage(1) ?? "", caption: "Consectetur" },
    { url: mockImage(0) ?? "", caption: "Adipiscing elit" },
    { url: mockImage(1) ?? "", caption: "Sed do eiusmod" },
    { url: mockImage(0) ?? "", caption: "Tempor incididunt" },
  ],
  faq: [
    { question: "Do you work on Saturdays?", answer: LOREM_SHORT },
    { question: "How soon can you come out?", answer: LOREM_SHORT },
    { question: "Do you give written quotes?", answer: LOREM_SHORT },
    { question: "Are you licensed?", answer: LOREM_SHORT },
  ],
  contact: {
    email: "hello@example.com",
    phone: "+977 1-4000000",
    address: "Balaju, Kathmandu",
    hours: "Sun–Fri, 9 to 6",
    mapUrl: null,
  },
}

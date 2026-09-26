"use client"

import { cn } from "cn"

import {
  linksAreLive,
  useSiteMode,
  useSlotRenderer,
} from "@/components/sites/site-mode"
import { Items, Text } from "@/components/sites/slots"
import type { SiteContent } from "@/models/site"

/**
 * The pieces every template is built from.
 *
 * Colour, type and corner radius all come from CSS custom properties that the
 * theme sets on the page root, so nothing in here names a colour. That is the
 * whole trick behind fifty templates: a layout decides the arrangement, a
 * theme decides the finish, and neither has to know about the other.
 *
 * Every piece also reads the site mode. What differs between the editor, a
 * preview, the live site and a gallery thumbnail is almost entirely what an
 * empty slot looks like and whether a link goes anywhere — so that is decided
 * here, once, rather than in each of the ten layouts.
 */

export const surface = "bg-[var(--site-surface)] border-[var(--site-border)]"
export const radius = "rounded-[var(--site-radius)]"
export const display = "font-[family-name:var(--site-display)]"
export const muted = "text-[var(--site-muted)]"

/**
 * An in-page anchor id, or nothing in a thumbnail — fifty copies of a page
 * on one screen would otherwise mean fifty elements called "top".
 */
export function useAnchor(id: string | undefined) {
  const mode = useSiteMode()
  return mode === "thumbnail" ? undefined : id
}

/** A page-width wrapper. Narrow for reading, wide for grids. */
export function Wrap({
  children,
  className,
  width = "wide",
}: {
  children: React.ReactNode
  className?: string
  width?: "narrow" | "wide" | "full"
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        width === "narrow" && "max-w-[720px]",
        width === "wide" && "max-w-[1120px]",
        width === "full" && "max-w-[1440px]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Section({
  children,
  className,
  tone = "bg",
  id,
}: {
  children: React.ReactNode
  className?: string
  /** "soft" is the theme's tinted band, for breaking up a long page. */
  tone?: "bg" | "soft" | "surface"
  id?: string
}) {
  const anchor = useAnchor(id)
  return (
    <section
      id={anchor}
      className={cn(
        "py-14 sm:py-20",
        tone === "soft" && "bg-[var(--site-soft)]",
        tone === "surface" && "bg-[var(--site-surface)]",
        className
      )}
    >
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--site-accent)] uppercase">
      {children}
    </span>
  )
}

export function Title({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode
  className?: string
  as?: "h1" | "h2" | "h3"
}) {
  return (
    <Tag
      className={cn(
        display,
        "m-0 leading-[1.12] font-bold tracking-[-0.02em] text-balance",
        Tag === "h1"
          ? "text-[clamp(2rem,5.5vw,3.6rem)]"
          : "text-[clamp(1.5rem,3vw,2.2rem)]",
        className
      )}
    >
      {children}
    </Tag>
  )
}

export function Lead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn(muted, "m-0 text-[17px] leading-relaxed", className)}>
      {children}
    </p>
  )
}

/** Paragraph text split on blank lines, so a typed body keeps its shape. */
export function Prose({
  text,
  className,
}: {
  text: string | null
  className?: string
}) {
  if (!text) return null
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {paragraphs.map((para, index) => (
        <p
          key={index}
          className="m-0 text-[15.5px] leading-[1.72] whitespace-pre-line"
        >
          {para}
        </p>
      ))}
    </div>
  )
}

/**
 * A link that only behaves as one where following it makes sense. In the
 * editor a click means "edit this" and in a thumbnail "pick this template",
 * so there it is a plain span with the same look.
 */
export function SiteLink({
  href,
  className,
  children,
}: {
  href: string | null | undefined
  className?: string
  children: React.ReactNode
}) {
  const mode = useSiteMode()
  if (!href || !linksAreLive(mode)) {
    return <span className={className}>{children}</span>
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

export function Button({
  href,
  children,
  variant = "solid",
}: {
  href: string
  children: React.ReactNode
  variant?: "solid" | "outline"
}) {
  return (
    <SiteLink
      href={href}
      className={cn(
        radius,
        "inline-flex items-center justify-center px-6 py-3 text-[14.5px] font-semibold no-underline transition-opacity hover:opacity-85",
        variant === "solid"
          ? "bg-[var(--site-accent)] text-[var(--site-accent-fg)]"
          : "border border-[var(--site-border)] bg-transparent text-[var(--site-fg)]"
      )}
    >
      {children}
    </SiteLink>
  )
}

/** The styled stand-in for an empty picture, in the editor and thumbnails. */
export function ImagePlaceholder({
  ratio = "4/3",
  className,
  label = "Add image",
}: {
  ratio?: string
  className?: string
  label?: string
}) {
  return (
    <div
      data-image-placeholder
      style={{ aspectRatio: ratio }}
      className={cn(
        radius,
        "flex w-full flex-col items-center justify-center gap-2 overflow-hidden border border-dashed border-[var(--site-border)] bg-[var(--site-soft)] text-[var(--site-muted)]",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="m21 16-5.2-5.2L6 20" />
      </svg>
      <span className="px-3 text-center text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>
    </div>
  )
}

/**
 * A picture, or what stands in for one.
 *
 * With a source it is the picture, everywhere. Without one it depends on who
 * is looking: the editor and a thumbnail show the "Add image" box, because
 * there it is something to click or an honest sample; a preview and the live
 * site show nothing at all — the caller decides how the section re-flows —
 * unless `empty="block"` asks for a quiet tinted block with no label, which
 * is what a product card or a gallery tile uses to keep its grid even.
 *
 * `slot` names the picture for the editor, which makes it clickable there.
 *
 * Plain `img` rather than `next/image`: these are arbitrary S3 URLs on a
 * tenant domain, and the optimiser would need each bucket whitelisted.
 */
export function Picture({
  src,
  alt,
  className,
  ratio = "4/3",
  slot,
  empty = "none",
}: {
  src: string | null
  alt: string
  className?: string
  ratio?: string
  slot?: string
  empty?: "none" | "block"
}) {
  const mode = useSiteMode()
  const renderer = useSlotRenderer()

  if (mode === "editor" && renderer && slot) {
    return (
      <>{renderer.image({ id: slot, value: src, alt, ratio, className })}</>
    )
  }

  if (!src) {
    if (mode === "editor" || mode === "thumbnail") {
      return <ImagePlaceholder ratio={ratio} className={className} />
    }
    if (empty === "block") {
      return (
        <div
          aria-hidden
          style={{ aspectRatio: ratio }}
          className={cn(radius, "w-full bg-[var(--site-soft)]", className)}
        />
      )
    }
    return null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      data-slot={slot}
      style={{ aspectRatio: ratio }}
      className={cn(radius, "w-full object-cover", className)}
    />
  )
}

/**
 * Whether a picture slot is going to draw anything. Layouts that put a
 * picture beside text use it to fall back to a single column on the live
 * site when there is no picture, instead of leaving half the row empty.
 */
export function usePictureShown(src: string | null) {
  const mode = useSiteMode()
  return Boolean(src) || mode === "editor" || mode === "thumbnail"
}

export function ServiceList({
  services,
  numbered = false,
  columns = 3,
}: {
  services: SiteContent["services"]
  numbered?: boolean
  columns?: 1 | 2 | 3
}) {
  if (services.length === 0) return null

  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-7",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 2 && "sm:grid-cols-2"
      )}
    >
      <Items id="services">
        {services.map((service, index) => (
          <div key={index} data-list-item className="flex flex-col gap-2">
            {numbered ? (
              <span
                className={cn(
                  display,
                  "text-[13px] font-bold text-[var(--site-accent)] tabular-nums"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : null}
            <h3 className={cn(display, "m-0 text-[17px] font-semibold")}>
              <Text id={`services.${index}.title`} value={service.title} />
            </h3>
            {service.body ? (
              <p className={cn(muted, "m-0 text-[14.5px] leading-relaxed")}>
                <Text
                  id={`services.${index}.body`}
                  value={service.body}
                  multiline
                />
              </p>
            ) : null}
          </div>
        ))}
      </Items>
    </div>
  )
}

export function ProductGrid({
  products,
  columns = 3,
  ratio = "4/3",
}: {
  products: SiteContent["products"]
  columns?: 2 | 3 | 4
  ratio?: string
}) {
  if (products.length === 0) return null

  return (
    <div
      className={cn(
        "grid gap-5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      <Items id="products">
        {products.map((product, index) => (
          <article
            key={index}
            data-list-item
            className={cn(
              radius,
              surface,
              "flex flex-col gap-3 overflow-hidden border p-3"
            )}
          >
            <Picture
              src={product.image}
              alt={product.name}
              ratio={ratio}
              slot={`products.${index}.image`}
              empty="block"
            />
            <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
              <h3 className={cn(display, "m-0 text-[15.5px] font-semibold")}>
                <Text id={`products.${index}.name`} value={product.name} />
              </h3>
              {product.blurb ? (
                <p className={cn(muted, "m-0 text-[13.5px] leading-relaxed")}>
                  <Text
                    id={`products.${index}.blurb`}
                    value={product.blurb}
                    multiline
                  />
                </p>
              ) : null}
              {product.price ? (
                <span className="mt-auto pt-1 text-[14px] font-semibold text-[var(--site-accent)]">
                  <Text id={`products.${index}.price`} value={product.price} />
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </Items>
    </div>
  )
}

/**
 * Questions and answers, open rather than folded away.
 *
 * `details` would hide the answers behind a click, which is the opposite of
 * why the section exists — these are the questions being asked on the phone,
 * and the point is that nobody has to ring to hear them.
 */
export function FaqList({
  faq,
  columns = 2,
}: {
  faq: SiteContent["faq"]
  columns?: 1 | 2
}) {
  if (faq.length === 0) return null

  return (
    <div className={cn("grid gap-7", columns === 2 && "sm:grid-cols-2")}>
      <Items id="faq">
        {faq.map((entry, index) => (
          <div key={index} data-list-item className="flex flex-col gap-1.5">
            <h3 className={cn(display, "m-0 text-[16px] font-semibold")}>
              <Text id={`faq.${index}.question`} value={entry.question} />
            </h3>
            <p className={cn(muted, "m-0 text-[14.5px] leading-relaxed")}>
              <Text
                id={`faq.${index}.answer`}
                value={entry.answer}
                multiline
              />
            </p>
          </div>
        ))}
      </Items>
    </div>
  )
}

/** Whether the contact section has anything to say. */
export function hasContact(contact: SiteContent["contact"]) {
  return Boolean(
    contact.phone || contact.email || contact.address || contact.hours
  )
}

export function ContactCard({
  contact,
  className,
}: {
  contact: SiteContent["contact"]
  className?: string
}) {
  const rows = [
    contact.phone
      ? {
          id: "contact.phone",
          label: "Phone",
          value: contact.phone,
          href: `tel:${contact.phone.replace(/\s+/g, "")}`,
        }
      : null,
    contact.email
      ? {
          id: "contact.email",
          label: "Email",
          value: contact.email,
          href: `mailto:${contact.email}`,
        }
      : null,
    contact.address
      ? {
          id: "contact.address",
          label: "Where",
          value: contact.address,
          href: contact.mapUrl,
        }
      : null,
    contact.hours
      ? { id: "contact.hours", label: "Open", value: contact.hours, href: null }
      : null,
  ].filter(Boolean) as {
    id: string
    label: string
    value: string
    href?: string | null
  }[]

  if (rows.length === 0) return null

  return (
    <dl className={cn("m-0 grid gap-5 sm:grid-cols-2", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <dt className="m-0 text-[10.5px] font-semibold tracking-[0.12em] text-[var(--site-muted)] uppercase">
            {row.label}
          </dt>
          <dd className="m-0 text-[15.5px] leading-snug">
            <SiteLink
              href={row.href}
              className={
                row.href
                  ? "text-[var(--site-fg)] underline decoration-[var(--site-border)] underline-offset-4 hover:decoration-[var(--site-accent)]"
                  : undefined
              }
            >
              <Text id={row.id} value={row.value} />
            </SiteLink>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Gallery({
  pictures,
  columns = 3,
}: {
  pictures: SiteContent["gallery"]
  columns?: 2 | 3 | 4
}) {
  if (pictures.length === 0) return null

  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4"
      )}
    >
      <Items id="gallery">
        {pictures.map((picture, index) => (
          <figure key={index} data-list-item className="m-0 flex flex-col gap-1.5">
            <Picture
              src={picture.url || null}
              alt={picture.caption ?? "Our work"}
              ratio="1/1"
              slot={`gallery.${index}.url`}
              empty="block"
            />
            {picture.caption ? (
              <figcaption className={cn(muted, "text-[12.5px]")}>
                <Text id={`gallery.${index}.caption`} value={picture.caption} />
              </figcaption>
            ) : null}
          </figure>
        ))}
      </Items>
    </div>
  )
}

/** The line at the bottom. Every template ends the same way. */
export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="border-t border-[var(--site-border)] py-10">
      <Wrap className="flex flex-wrap items-center justify-between gap-4">
        <span className={cn(display, "text-[15px] font-semibold")}>
          {content.name}
        </span>
        <span className={cn(muted, "text-[12.5px]")}>
          {contactLine(content)}
        </span>
      </Wrap>
    </footer>
  )
}

function contactLine(content: SiteContent) {
  return (
    [content.contact.phone, content.contact.email, content.contact.address]
      .filter(Boolean)
      .join(" · ") || content.tagline || ""
  )
}

/** The bar across the top. Links only to sections the template actually has. */
export function SiteNav({
  content,
  sections,
}: {
  content: SiteContent
  sections: string[]
}) {
  const mode = useSiteMode()
  const links = [
    sections.includes("services") && content.services.length > 0
      ? { href: "#services", label: "What we do" }
      : null,
    sections.includes("products") && content.products.length > 0
      ? { href: "#products", label: "What we sell" }
      : null,
    sections.includes("gallery") && content.gallery.length > 0
      ? { href: "#gallery", label: "Pictures" }
      : null,
    sections.includes("faq") && content.faq.length > 0
      ? { href: "#faq", label: "Questions" }
      : null,
    sections.includes("contact") && hasContact(content.contact)
      ? { href: "#contact", label: "Contact" }
      : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <header
      className={cn(
        "border-b border-[var(--site-border)] bg-[color-mix(in_oklab,var(--site-bg)_88%,transparent)]",
        // A thumbnail is a still picture of the page; a sticky bar inside a
        // scaled frame would only fight the card it sits in.
        mode !== "thumbnail" && "sticky top-0 z-40 backdrop-blur-[10px]"
      )}
    >
      <Wrap className="flex items-center justify-between gap-6 py-3.5">
        <SiteLink
          href="#top"
          className={cn(display, "text-[15.5px] font-bold no-underline")}
        >
          {content.name}
        </SiteLink>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map((link) => (
            <SiteLink
              key={link.href}
              href={link.href}
              className={cn(
                muted,
                "text-[13.5px] no-underline hover:text-[var(--site-fg)]"
              )}
            >
              {link.label}
            </SiteLink>
          ))}
        </nav>
      </Wrap>
    </header>
  )
}

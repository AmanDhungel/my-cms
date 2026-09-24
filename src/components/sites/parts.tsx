import { cn } from "cn"

import type { SiteContent } from "@/models/site"

/**
 * The pieces every template is built from.
 *
 * Colour, type and corner radius all come from CSS custom properties that the
 * theme sets on the page root, so nothing in here names a colour. That is the
 * whole trick behind fifty templates: a layout decides the arrangement, a
 * theme decides the finish, and neither has to know about the other.
 */

export const surface = "bg-[var(--site-surface)] border-[var(--site-border)]"
export const radius = "rounded-[var(--site-radius)]"
export const display = "font-[family-name:var(--site-display)]"
export const muted = "text-[var(--site-muted)]"

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
  return (
    <section
      id={id}
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
    <a
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
    </a>
  )
}

/**
 * A picture, or a stand-in that doesn't look broken.
 *
 * A site is usually published before every photograph has been taken, and a
 * missing image should read as "not yet" rather than as a fault. Plain `img`
 * rather than `next/image`: these are arbitrary S3 URLs on a tenant domain,
 * and the optimiser would need each bucket whitelisted in the config.
 */
export function Picture({
  src,
  alt,
  className,
  ratio = "4/3",
}: {
  src: string | null
  alt: string
  className?: string
  ratio?: string
}) {
  if (!src) {
    return (
      <div
        style={{ aspectRatio: ratio }}
        className={cn(
          radius,
          "flex w-full items-center justify-center overflow-hidden border border-dashed border-[var(--site-border)] bg-[var(--site-soft)]",
          className
        )}
      >
        <span className="px-4 text-center text-[10.5px] font-semibold tracking-[0.14em] text-[var(--site-muted)] uppercase">
          {alt || "Picture to come"}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      style={{ aspectRatio: ratio }}
      className={cn(radius, "w-full object-cover", className)}
    />
  )
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
      {services.map((service, index) => (
        <div key={index} className="flex flex-col gap-2">
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
            {service.title}
          </h3>
          {service.body ? (
            <p className={cn(muted, "m-0 text-[14.5px] leading-relaxed")}>
              {service.body}
            </p>
          ) : null}
        </div>
      ))}
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
      {products.map((product, index) => (
        <article
          key={index}
          className={cn(
            radius,
            surface,
            "flex flex-col gap-3 overflow-hidden border p-3"
          )}
        >
          <Picture src={product.image} alt={product.name} ratio={ratio} />
          <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1">
            <h3 className={cn(display, "m-0 text-[15.5px] font-semibold")}>
              {product.name}
            </h3>
            {product.blurb ? (
              <p className={cn(muted, "m-0 text-[13.5px] leading-relaxed")}>
                {product.blurb}
              </p>
            ) : null}
            {product.price ? (
              <span className="mt-auto pt-1 text-[14px] font-semibold text-[var(--site-accent)]">
                {product.price}
              </span>
            ) : null}
          </div>
        </article>
      ))}
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
      {faq.map((entry, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <h3 className={cn(display, "m-0 text-[16px] font-semibold")}>
            {entry.question}
          </h3>
          <p className={cn(muted, "m-0 text-[14.5px] leading-relaxed")}>
            {entry.answer}
          </p>
        </div>
      ))}
    </div>
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
    contact.phone ? { label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/\s+/g, "")}` } : null,
    contact.email ? { label: "Email", value: contact.email, href: `mailto:${contact.email}` } : null,
    contact.address ? { label: "Where", value: contact.address, href: contact.mapUrl } : null,
    contact.hours ? { label: "Open", value: contact.hours, href: null } : null,
  ].filter(Boolean) as { label: string; value: string; href?: string | null }[]

  if (rows.length === 0) return null

  return (
    <dl className={cn("m-0 grid gap-5 sm:grid-cols-2", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <dt className="m-0 text-[10.5px] font-semibold tracking-[0.12em] text-[var(--site-muted)] uppercase">
            {row.label}
          </dt>
          <dd className="m-0 text-[15.5px] leading-snug">
            {row.href ? (
              <a
                href={row.href}
                className="text-[var(--site-fg)] underline decoration-[var(--site-border)] underline-offset-4 hover:decoration-[var(--site-accent)]"
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
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
      {pictures.map((picture, index) => (
        <figure key={index} className="m-0 flex flex-col gap-1.5">
          <Picture
            src={picture.url}
            alt={picture.caption ?? "Our work"}
            ratio="1/1"
          />
          {picture.caption ? (
            <figcaption className={cn(muted, "text-[12.5px]")}>
              {picture.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
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
    sections.includes("contact") ? { href: "#contact", label: "Contact" } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--site-border)] bg-[color-mix(in_oklab,var(--site-bg)_88%,transparent)] backdrop-blur-[10px]">
      <Wrap className="flex items-center justify-between gap-6 py-3.5">
        <a
          href="#top"
          className={cn(display, "text-[15.5px] font-bold no-underline")}
        >
          {content.name}
        </a>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                muted,
                "text-[13.5px] no-underline hover:text-[var(--site-fg)]"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </Wrap>
    </header>
  )
}

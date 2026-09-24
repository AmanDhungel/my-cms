import { cn } from "cn"

import {
  Button,
  ContactCard,
  Eyebrow,
  FaqList,
  Footer,
  Gallery,
  Lead,
  Picture,
  ProductGrid,
  Prose,
  Section,
  ServiceList,
  SiteNav,
  Title,
  Wrap,
  display,
  muted,
  radius,
  surface,
} from "@/components/sites/parts"
import type { SiteContent } from "@/models/site"

/**
 * The ten page structures.
 *
 * Each takes the same content and decides what leads, what follows and how
 * the eye travels down the page. None of them names a colour or a typeface —
 * that is the theme's job — so every one of them works in all five finishes.
 *
 * A section is drawn only when it has something in it. A business with no
 * FAQ yet gets a page with no gap where the FAQ would be, rather than an
 * empty heading, which is what keeps a half-filled site presentable.
 */

export type LayoutProps = { content: SiteContent; sections: string[] }

const has = (sections: string[], key: string) => sections.includes(key)

/** The heading each section gets when the owner hasn't written their own. */
function Head({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow?: string
  title: string
  lead?: string | null
  className?: string
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-2.5", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Title>{title}</Title>
      {lead ? <Lead>{lead}</Lead> : null}
    </div>
  )
}

function heroCta(content: SiteContent) {
  const label = content.hero.ctaLabel
  const href =
    content.hero.ctaHref ??
    (content.contact.phone
      ? `tel:${content.contact.phone.replace(/\s+/g, "")}`
      : "#contact")

  return label ? <Button href={href}>{label}</Button> : null
}

// ---------------------------------------------------------------- spotlight

export function Spotlight({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-16 text-center sm:pt-24">
        <Wrap className="flex flex-col items-center gap-6">
          {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
          <Title as="h1" className="max-w-[900px]">
            {content.hero.headline ?? content.name}
          </Title>
          {content.hero.sub ? (
            <Lead className="max-w-[640px]">{content.hero.sub}</Lead>
          ) : null}
          {heroCta(content)}
          {content.hero.image ? (
            <Picture
              src={content.hero.image}
              alt={content.name}
              ratio="16/7"
              className="mt-6"
            />
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-5 text-center">
            <Title>{content.about.title ?? "About us"}</Title>
            <Prose text={content.about.body} className="text-left" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-10">
            <Head eyebrow="What we do" title="Our services" className="mx-auto text-center" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head eyebrow="What we sell" title="Our range" />
            <ProductGrid products={content.products} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-10">
            <Head title="Questions we get asked" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Head title="Come and find us" />
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// -------------------------------------------------------------------- split

export function Split({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-12 sm:pt-16">
        <Wrap className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
            <Title as="h1">{content.hero.headline ?? content.name}</Title>
            {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
            <div className="pt-1">{heroCta(content)}</div>
          </div>
          <Picture src={content.hero.image} alt={content.name} ratio="5/4" />
        </Wrap>
      </Section>

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap className="grid items-center gap-10 lg:grid-cols-2">
            {/* Mirrored, so the page alternates rather than marching. */}
            <Picture
              src={content.about.image}
              alt={content.about.title ?? "About us"}
              ratio="4/3"
              className="lg:order-2"
            />
            <div className="flex flex-col gap-4 lg:order-1">
              <Title>{content.about.title ?? "About us"}</Title>
              <Prose text={content.about.body} />
            </div>
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-10">
            <Head eyebrow="What we do" title="Our services" />
            <ServiceList services={content.services} columns={2} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head eyebrow="What we sell" title="Our range" />
            <ProductGrid products={content.products} columns={3} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap width="narrow" className="flex flex-col gap-9">
            <Title>Questions we get asked</Title>
            <FaqList faq={content.faq} columns={1} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Title>Get in touch</Title>
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ---------------------------------------------------------------- catalogue

export function Catalogue({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Deliberately short: the goods are the point, so they start high. */}
      <Section id="top" className="py-9 sm:py-12">
        <Wrap className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex max-w-[560px] flex-col gap-2">
            <Title as="h1">{content.hero.headline ?? content.name}</Title>
            {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
          </div>
          {heroCta(content)}
        </Wrap>
      </Section>

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" className="pt-0">
          <Wrap>
            <ProductGrid products={content.products} columns={4} ratio="1/1" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head title="We also do" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-9">
            <Head title="Before you order" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Title>Where to find us</Title>
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ----------------------------------------------------------------- services

export function Services({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-14 sm:pt-20">
        <Wrap className="flex flex-col gap-5">
          {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
          <Title as="h1" className="max-w-[860px]">
            {content.hero.headline ?? content.name}
          </Title>
          {content.hero.sub ? (
            <Lead className="max-w-[620px]">{content.hero.sub}</Lead>
          ) : null}
          <div className="pt-1">{heroCta(content)}</div>
        </Wrap>
      </Section>

      {/* The list is the page, so it is numbered and given room. */}
      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head eyebrow="What we take on" title="The work we do" />
            <ServiceList services={content.services} numbered columns={2} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section>
          <Wrap className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-4">
              <Title>{content.about.title ?? "Who you'd be hiring"}</Title>
              <Prose text={content.about.body} />
            </div>
            <Picture
              src={content.about.image}
              alt={content.about.title ?? content.name}
              ratio="4/5"
            />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head title="Questions we get asked" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact">
          <Wrap className="flex flex-col gap-8">
            <Title>Ask us about a job</Title>
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ------------------------------------------------------------------- ledger

export function Ledger({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* One column the whole way down. No pictures at all, by design. */}
      <Section id="top" className="pt-16 sm:pt-24">
        <Wrap width="narrow" className="flex flex-col gap-5">
          {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
          <Title as="h1">{content.hero.headline ?? content.name}</Title>
          {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
          {content.hero.ctaLabel ? (
            <div className="pt-2">{heroCta(content)}</div>
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "about") && content.about.body ? (
        <Section className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-4">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              {content.about.title ?? "About the practice"}
            </Title>
            <Prose text={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-6">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              What we handle
            </Title>
            <ServiceList services={content.services} columns={1} numbered />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq" className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-6">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              Common questions
            </Title>
            <FaqList faq={content.faq} columns={1} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-6">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              Contact
            </Title>
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// --------------------------------------------------------------- storefront

export function Storefront({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* A banner with the words sitting on it, like a shop sign. */}
      <section id="top" className="relative">
        <Picture
          src={content.hero.image}
          alt={content.name}
          ratio="21/9"
          className="rounded-none"
        />
        <div className="border-b border-[var(--site-border)] bg-[var(--site-surface)]">
          <Wrap className="flex flex-wrap items-center justify-between gap-5 py-7">
            <div className="flex max-w-[620px] flex-col gap-2">
              <Title as="h1" className="text-[clamp(1.7rem,4vw,2.6rem)]">
                {content.hero.headline ?? content.name}
              </Title>
              {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
            </div>
            <div className="flex flex-col items-start gap-2">
              {content.contact.hours ? (
                <span className={cn(muted, "text-[13px]")}>
                  Open {content.contact.hours}
                </span>
              ) : null}
              {heroCta(content)}
            </div>
          </Wrap>
        </div>
      </section>

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products">
          <Wrap className="flex flex-col gap-9">
            <Head eyebrow="In the shop" title="What we stock" />
            <ProductGrid products={content.products} columns={3} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Title>{content.about.title ?? "About the shop"}</Title>
              <Prose text={content.about.body} />
            </div>
            <Picture
              src={content.about.image}
              alt={content.about.title ?? content.name}
              ratio="4/3"
            />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact">
          <Wrap className="flex flex-col gap-8">
            <Head title="Come in" lead={content.contact.hours} />
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head title="Good to know" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ------------------------------------------------------------------ atelier

export function Atelier({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Very few words, and they sit in a lot of space. */}
      <Section id="top" className="pt-20 pb-10 sm:pt-28">
        <Wrap width="narrow" className="flex flex-col items-center gap-5 text-center">
          <Title as="h1">{content.hero.headline ?? content.name}</Title>
          {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
        </Wrap>
      </Section>

      {content.hero.image ? (
        <Wrap width="full" className="px-0 sm:px-0">
          <Picture
            src={content.hero.image}
            alt={content.name}
            ratio="16/9"
            className="rounded-none"
          />
        </Wrap>
      ) : null}

      {has(sections, "gallery") && content.gallery.length > 0 ? (
        <Section id="gallery">
          <Wrap width="full">
            <Gallery pictures={content.gallery} columns={3} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-4">
            <Title>{content.about.title ?? "The work"}</Title>
            <Prose text={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products">
          <Wrap className="flex flex-col gap-9">
            <Head title="Available now" />
            <ProductGrid products={content.products} columns={3} ratio="3/4" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-7 text-center">
            <Title>Enquiries</Title>
            <ContactCard contact={content.contact} className="text-left" />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ----------------------------------------------------------------- bulletin

export function Bulletin({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Dense on purpose: as much as possible visible without scrolling. */}
      <Section id="top" className="py-9">
        <Wrap className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-4 border-b border-[var(--site-border)] pb-7 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
            {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
            <Title as="h1">{content.hero.headline ?? content.name}</Title>
            {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
            {content.description ? (
              <Prose text={content.description} />
            ) : null}
            <div className="pt-1">{heroCta(content)}</div>
          </div>

          <aside className="flex flex-col gap-5">
            {has(sections, "contact") ? (
              <div className={cn(radius, surface, "border p-5")}>
                <ContactCard contact={content.contact} className="sm:grid-cols-1" />
              </div>
            ) : null}
            <Picture src={content.hero.image} alt={content.name} ratio="4/3" />
          </aside>
        </Wrap>
      </Section>

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" tone="soft" className="py-10">
          <Wrap className="flex flex-col gap-7">
            <Head title="What we do" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" className="py-10">
          <Wrap className="flex flex-col gap-7">
            <Head title="What we sell" />
            <ProductGrid products={content.products} columns={4} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft" className="py-10">
          <Wrap className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Title as="h3" className="text-[20px]">
                {content.about.title ?? "About us"}
              </Title>
              <Prose text={content.about.body} />
            </div>
            {has(sections, "faq") && content.faq.length > 0 ? (
              <div id="faq" className="flex flex-col gap-3">
                <Title as="h3" className="text-[20px]">
                  Questions
                </Title>
                <FaqList faq={content.faq} columns={1} />
              </div>
            ) : null}
          </Wrap>
        </Section>
      ) : null}

      <div id="contact" />
      <Footer content={content} />
    </>
  )
}

// ------------------------------------------------------------------- beacon

export function Beacon({ content, sections }: LayoutProps) {
  const phone = content.contact.phone

  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/*
        The number is the page. Someone reaching a call-out site is usually
        standing next to the problem, so the one thing they need is enormous
        and above everything else.
      */}
      <Section id="top" className="py-16 text-center sm:py-24">
        <Wrap className="flex flex-col items-center gap-6">
          {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
          <Title as="h1" className="max-w-[820px]">
            {content.hero.headline ?? content.name}
          </Title>
          {content.hero.sub ? (
            <Lead className="max-w-[560px]">{content.hero.sub}</Lead>
          ) : null}

          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className={cn(
                display,
                "mt-2 text-[clamp(2.2rem,8vw,4.5rem)] leading-none font-bold tracking-[-0.03em] text-[var(--site-accent)] no-underline tabular-nums"
              )}
            >
              {phone}
            </a>
          ) : (
            heroCta(content)
          )}

          {content.contact.hours ? (
            <span className={cn(muted, "text-[14px]")}>
              {content.contact.hours}
            </span>
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft" className="py-10">
          <Wrap className="flex flex-col gap-6">
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-9">
            <Head title="What we come out for" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-4">
            <Title>{content.about.title ?? "Who we are"}</Title>
            <Prose text={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-9">
            <Head title="Before you call" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

// ------------------------------------------------------------------ gallery

export function GalleryLayout({ content, sections }: LayoutProps) {
  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Words squeezed to the side; the wall of pictures does the work. */}
      <Section id="top" className="py-10">
        <Wrap className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div className="flex flex-col gap-3">
            {content.tagline ? <Eyebrow>{content.tagline}</Eyebrow> : null}
            <Title as="h1" className="text-[clamp(1.8rem,4vw,2.8rem)]">
              {content.hero.headline ?? content.name}
            </Title>
            {content.hero.sub ? <Lead>{content.hero.sub}</Lead> : null}
            {content.hero.ctaLabel ? (
              <div className="pt-1">{heroCta(content)}</div>
            ) : null}
          </div>
          <Picture src={content.hero.image} alt={content.name} ratio="16/9" />
        </Wrap>
      </Section>

      {has(sections, "gallery") && content.gallery.length > 0 ? (
        <Section id="gallery" className="pt-0">
          <Wrap width="full">
            <Gallery pictures={content.gallery} columns={4} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head title="For sale" />
            <ProductGrid products={content.products} columns={4} ratio="1/1" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section>
          <Wrap width="narrow" className="flex flex-col gap-4">
            <Title>{content.about.title ?? "About"}</Title>
            <Prose text={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "contact") ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-7">
            <Title>Get in touch</Title>
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      <Footer content={content} />
    </>
  )
}

/** Which component draws which layout id. */
export const LAYOUT_COMPONENTS: Record<
  string,
  (props: LayoutProps) => React.ReactElement
> = {
  spotlight: Spotlight,
  split: Split,
  catalogue: Catalogue,
  services: Services,
  ledger: Ledger,
  storefront: Storefront,
  atelier: Atelier,
  bulletin: Bulletin,
  beacon: Beacon,
  gallery: GalleryLayout,
}

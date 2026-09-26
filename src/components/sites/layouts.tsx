"use client"

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
  Section,
  ServiceList,
  SiteLink,
  SiteNav,
  Title,
  Wrap,
  display,
  hasContact,
  muted,
  radius,
  surface,
  useAnchor,
  usePictureShown,
} from "@/components/sites/parts"
import { Extra, ProseText, Text } from "@/components/sites/slots"
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
 * empty heading, which is what keeps a half-filled site presentable. In the
 * editor and in thumbnails the content arrives already padded with samples,
 * so the same checks show every section there.
 *
 * Every piece of text goes through a slot (`Text`, `ProseText`, `Extra`)
 * named by its path in the content, which is what makes it editable in place
 * without the layout knowing an editor exists.
 *
 * EMPTY IMAGE SLOTS, PER TEMPLATE — what a preview or the live site does when
 * a picture has not been added. (The editor always shows an "Add image" box
 * and a thumbnail always shows a sample, in every template.)
 *
 * - spotlight:  hero picture left out; the centred hero stands alone.
 * - split:      hero becomes one column of text; about becomes text only.
 * - catalogue:  no hero picture by design; product cards keep a plain block.
 * - services:   about becomes text only.
 * - ledger:     no pictures by design.
 * - storefront: the banner picture is left out and the sign bar leads;
 *               about becomes text only.
 * - atelier:    the full-width picture is left out.
 * - bulletin:   the side picture is left out; the contact card stays.
 * - beacon:     no pictures by design.
 * - gallery:    hero becomes one column of text.
 *
 * Everywhere: a product card or gallery tile with no picture keeps a plain
 * tinted block with no label, so its grid stays even.
 */

export type LayoutProps = { content: SiteContent; sections: string[] }

const has = (sections: string[], key: string) => sections.includes(key)

/** A section heading in the template's own words, which the owner may reword. */
function heading(section: string, fallback: string) {
  return <Extra id={`heading.${section}.title`} fallback={fallback} />
}

/** The heading each section gets when the owner hasn't written their own. */
function Head({
  section,
  eyebrow,
  title,
  lead,
  className,
}: {
  section: string
  eyebrow?: string
  title: string
  lead?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-2.5", className)}>
      {eyebrow ? (
        <Eyebrow>
          <Extra id={`heading.${section}.eyebrow`} fallback={eyebrow} />
        </Eyebrow>
      ) : null}
      <Title>{heading(section, title)}</Title>
      {lead ? <Lead>{lead}</Lead> : null}
    </div>
  )
}

function Tagline({ content }: { content: SiteContent }) {
  return content.tagline ? (
    <Eyebrow>
      <Text id="tagline" value={content.tagline} />
    </Eyebrow>
  ) : null
}

/** With no headline typed, the business name is what publishes — and shows. */
function Headline({ content }: { content: SiteContent }) {
  return (
    <Text id="hero.headline" value={content.hero.headline} fallback={content.name} />
  )
}

function Sub({
  content,
  className,
}: {
  content: SiteContent
  className?: string
}) {
  return content.hero.sub ? (
    <Lead className={className}>
      <Text id="hero.sub" value={content.hero.sub} />
    </Lead>
  ) : null
}

function AboutTitle({
  content,
  fallback,
}: {
  content: SiteContent
  fallback: string
}) {
  return <Text id="about.title" value={content.about.title} fallback={fallback} />
}

function heroCta(content: SiteContent) {
  const label = content.hero.ctaLabel
  const href =
    content.hero.ctaHref ??
    (content.contact.phone
      ? `tel:${content.contact.phone.replace(/\s+/g, "")}`
      : "#contact")

  return label ? (
    <Button href={href}>
      <Text id="hero.ctaLabel" value={label} />
    </Button>
  ) : null
}

const showContact = (sections: string[], content: SiteContent) =>
  has(sections, "contact") && hasContact(content.contact)

// ---------------------------------------------------------------- spotlight

export function Spotlight({ content, sections }: LayoutProps) {
  const heroPicture = usePictureShown(content.hero.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-16 text-center sm:pt-24">
        <Wrap className="flex flex-col items-center gap-6">
          <Tagline content={content} />
          <Title as="h1" className="max-w-[900px]">
            <Headline content={content} />
          </Title>
          <Sub content={content} className="max-w-[640px]" />
          {heroCta(content)}
          {heroPicture ? (
            <Picture
              src={content.hero.image}
              alt={content.name}
              ratio="16/7"
              className="mt-6"
              slot="hero.image"
            />
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-5 text-center">
            <Title>
              <AboutTitle content={content} fallback="About us" />
            </Title>
            <ProseText id="about.body" value={content.about.body} className="text-left" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-10">
            <Head
              section="services"
              eyebrow="What we do"
              title="Our services"
              className="mx-auto text-center"
            />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head section="products" eyebrow="What we sell" title="Our range" />
            <ProductGrid products={content.products} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-10">
            <Head section="faq" title="Questions we get asked" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Head section="contact" title="Come and find us" />
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
  const heroPicture = usePictureShown(content.hero.image)
  const aboutPicture = usePictureShown(content.about.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-12 sm:pt-16">
        <Wrap
          className={cn(
            "grid items-center gap-10",
            heroPicture && "lg:grid-cols-2"
          )}
        >
          <div className={cn("flex flex-col gap-5", !heroPicture && "max-w-[760px]")}>
            <Tagline content={content} />
            <Title as="h1">
              <Headline content={content} />
            </Title>
            <Sub content={content} />
            <div className="pt-1">{heroCta(content)}</div>
          </div>
          {heroPicture ? (
            <Picture
              src={content.hero.image}
              alt={content.name}
              ratio="5/4"
              slot="hero.image"
            />
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap
            className={cn(
              "grid items-center gap-10",
              aboutPicture && "lg:grid-cols-2"
            )}
          >
            {/* Mirrored, so the page alternates rather than marching. */}
            {aboutPicture ? (
              <Picture
                src={content.about.image}
                alt={content.about.title ?? "About us"}
                ratio="4/3"
                className="lg:order-2"
                slot="about.image"
              />
            ) : null}
            <div
              className={cn(
                "flex flex-col gap-4 lg:order-1",
                !aboutPicture && "max-w-[720px]"
              )}
            >
              <Title>
                <AboutTitle content={content} fallback="About us" />
              </Title>
              <ProseText id="about.body" value={content.about.body} />
            </div>
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-10">
            <Head section="services" eyebrow="What we do" title="Our services" />
            <ServiceList services={content.services} columns={2} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head section="products" eyebrow="What we sell" title="Our range" />
            <ProductGrid products={content.products} columns={3} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap width="narrow" className="flex flex-col gap-9">
            <Title>{heading("faq", "Questions we get asked")}</Title>
            <FaqList faq={content.faq} columns={1} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Title>{heading("contact", "Get in touch")}</Title>
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
            <Title as="h1">
              <Headline content={content} />
            </Title>
            <Sub content={content} />
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
            <Head section="services" title="We also do" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-9">
            <Head section="faq" title="Before you order" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-8">
            <Title>{heading("contact", "Where to find us")}</Title>
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
  const aboutPicture = usePictureShown(content.about.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      <Section id="top" className="pt-14 sm:pt-20">
        <Wrap className="flex flex-col gap-5">
          <Tagline content={content} />
          <Title as="h1" className="max-w-[860px]">
            <Headline content={content} />
          </Title>
          <Sub content={content} className="max-w-[620px]" />
          <div className="pt-1">{heroCta(content)}</div>
        </Wrap>
      </Section>

      {/* The list is the page, so it is numbered and given room. */}
      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" tone="soft">
          <Wrap className="flex flex-col gap-10">
            <Head section="services" eyebrow="What we take on" title="The work we do" />
            <ServiceList services={content.services} numbered columns={2} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section>
          <Wrap
            className={cn(
              "grid items-start gap-10",
              aboutPicture && "lg:grid-cols-[1.2fr_1fr]"
            )}
          >
            <div className={cn("flex flex-col gap-4", !aboutPicture && "max-w-[720px]")}>
              <Title>
                <AboutTitle content={content} fallback="Who you'd be hiring" />
              </Title>
              <ProseText id="about.body" value={content.about.body} />
            </div>
            {aboutPicture ? (
              <Picture
                src={content.about.image}
                alt={content.about.title ?? content.name}
                ratio="4/5"
                slot="about.image"
              />
            ) : null}
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head section="faq" title="Questions we get asked" />
            <FaqList faq={content.faq} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact">
          <Wrap className="flex flex-col gap-8">
            <Title>{heading("contact", "Ask us about a job")}</Title>
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
          <Tagline content={content} />
          <Title as="h1">
            <Headline content={content} />
          </Title>
          <Sub content={content} />
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
              <AboutTitle content={content} fallback="About the practice" />
            </Title>
            <ProseText id="about.body" value={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-6">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              {heading("services", "What we handle")}
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
              {heading("faq", "Common questions")}
            </Title>
            <FaqList faq={content.faq} columns={1} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" className="pt-0">
          <Wrap width="narrow" className="flex flex-col gap-6">
            <div className="h-px w-full bg-[var(--site-border)]" />
            <Title as="h3" className="text-[19px]">
              {heading("contact", "Contact")}
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
  const top = useAnchor("top")
  const heroPicture = usePictureShown(content.hero.image)
  const aboutPicture = usePictureShown(content.about.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* A banner with the words sitting on it, like a shop sign. */}
      <section id={top} className="relative">
        {heroPicture ? (
          <Picture
            src={content.hero.image}
            alt={content.name}
            ratio="21/9"
            className="rounded-none"
            slot="hero.image"
          />
        ) : null}
        <div className="border-b border-[var(--site-border)] bg-[var(--site-surface)]">
          <Wrap className="flex flex-wrap items-center justify-between gap-5 py-7">
            <div className="flex max-w-[620px] flex-col gap-2">
              <Title as="h1" className="text-[clamp(1.7rem,4vw,2.6rem)]">
                <Headline content={content} />
              </Title>
              <Sub content={content} />
            </div>
            <div className="flex flex-col items-start gap-2">
              {content.contact.hours ? (
                <span className={cn(muted, "text-[13px]")}>
                  Open <Text id="contact.hours" value={content.contact.hours} />
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
            <Head section="products" eyebrow="In the shop" title="What we stock" />
            <ProductGrid products={content.products} columns={3} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap
            className={cn(
              "grid items-center gap-10",
              aboutPicture && "lg:grid-cols-2"
            )}
          >
            <div className={cn("flex flex-col gap-4", !aboutPicture && "max-w-[720px]")}>
              <Title>
                <AboutTitle content={content} fallback="About the shop" />
              </Title>
              <ProseText id="about.body" value={content.about.body} />
            </div>
            {aboutPicture ? (
              <Picture
                src={content.about.image}
                alt={content.about.title ?? content.name}
                ratio="4/3"
                slot="about.image"
              />
            ) : null}
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact">
          <Wrap className="flex flex-col gap-8">
            <Head
              section="contact"
              title="Come in"
              lead={
                content.contact.hours ? (
                  <Text id="contact.hours" value={content.contact.hours} />
                ) : null
              }
            />
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq" tone="soft">
          <Wrap className="flex flex-col gap-9">
            <Head section="faq" title="Good to know" />
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
  const heroPicture = usePictureShown(content.hero.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Very few words, and they sit in a lot of space. */}
      <Section id="top" className="pt-20 pb-10 sm:pt-28">
        <Wrap width="narrow" className="flex flex-col items-center gap-5 text-center">
          <Title as="h1">
            <Headline content={content} />
          </Title>
          <Sub content={content} />
        </Wrap>
      </Section>

      {heroPicture ? (
        <Wrap width="full" className="px-0 sm:px-0">
          <Picture
            src={content.hero.image}
            alt={content.name}
            ratio="16/9"
            className="rounded-none"
            slot="hero.image"
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
            <Title>
              <AboutTitle content={content} fallback="The work" />
            </Title>
            <ProseText id="about.body" value={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products">
          <Wrap className="flex flex-col gap-9">
            <Head section="products" title="Available now" />
            <ProductGrid products={content.products} columns={3} ratio="3/4" />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-7 text-center">
            <Title>{heading("contact", "Enquiries")}</Title>
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
  const faqAnchor = useAnchor("faq")
  const contactAnchor = useAnchor("contact")
  const heroPicture = usePictureShown(content.hero.image)
  const contactCard = showContact(sections, content)
  const showAbout = has(sections, "about") && Boolean(content.about.body)
  const showFaq = has(sections, "faq") && content.faq.length > 0

  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Dense on purpose: as much as possible visible without scrolling. */}
      <Section id="top" className="py-9">
        <Wrap
          className={cn(
            "grid gap-8",
            (contactCard || heroPicture) && "lg:grid-cols-[1.6fr_1fr]"
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-4",
              (contactCard || heroPicture) &&
                "border-b border-[var(--site-border)] pb-7 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0"
            )}
          >
            <Tagline content={content} />
            <Title as="h1">
              <Headline content={content} />
            </Title>
            <Sub content={content} />
            {content.description ? (
              <ProseText id="description" value={content.description} />
            ) : null}
            <div className="pt-1">{heroCta(content)}</div>
          </div>

          {contactCard || heroPicture ? (
            <aside className="flex flex-col gap-5">
              {contactCard ? (
                <div className={cn(radius, surface, "border p-5")}>
                  <ContactCard contact={content.contact} className="sm:grid-cols-1" />
                </div>
              ) : null}
              {heroPicture ? (
                <Picture
                  src={content.hero.image}
                  alt={content.name}
                  ratio="4/3"
                  slot="hero.image"
                />
              ) : null}
            </aside>
          ) : null}
        </Wrap>
      </Section>

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services" tone="soft" className="py-10">
          <Wrap className="flex flex-col gap-7">
            <Head section="services" title="What we do" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "products") && content.products.length > 0 ? (
        <Section id="products" className="py-10">
          <Wrap className="flex flex-col gap-7">
            <Head section="products" title="What we sell" />
            <ProductGrid products={content.products} columns={4} />
          </Wrap>
        </Section>
      ) : null}

      {/* About and the questions share a band, but either can stand alone. */}
      {showAbout || showFaq ? (
        <Section tone="soft" className="py-10">
          <Wrap className={cn("grid gap-8", showAbout && showFaq && "lg:grid-cols-2")}>
            {showAbout ? (
              <div className="flex flex-col gap-3">
                <Title as="h3" className="text-[20px]">
                  <AboutTitle content={content} fallback="About us" />
                </Title>
                <ProseText id="about.body" value={content.about.body} />
              </div>
            ) : null}
            {showFaq ? (
              <div id={faqAnchor} className="flex flex-col gap-3">
                <Title as="h3" className="text-[20px]">
                  {heading("faq", "Questions")}
                </Title>
                <FaqList faq={content.faq} columns={1} />
              </div>
            ) : null}
          </Wrap>
        </Section>
      ) : null}

      <div id={contactAnchor} />
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
          <Tagline content={content} />
          <Title as="h1" className="max-w-[820px]">
            <Headline content={content} />
          </Title>
          <Sub content={content} className="max-w-[560px]" />

          {phone ? (
            <SiteLink
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className={cn(
                display,
                "mt-2 text-[clamp(2.2rem,8vw,4.5rem)] leading-none font-bold tracking-[-0.03em] text-[var(--site-accent)] no-underline tabular-nums"
              )}
            >
              <Text id="contact.phone" value={phone} />
            </SiteLink>
          ) : (
            heroCta(content)
          )}

          {content.contact.hours ? (
            <span className={cn(muted, "text-[14px]")}>
              <Text id="contact.hours" value={content.contact.hours} />
            </span>
          ) : null}
        </Wrap>
      </Section>

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft" className="py-10">
          <Wrap className="flex flex-col gap-6">
            <ContactCard contact={content.contact} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "services") && content.services.length > 0 ? (
        <Section id="services">
          <Wrap className="flex flex-col gap-9">
            <Head section="services" title="What we come out for" />
            <ServiceList services={content.services} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section tone="soft">
          <Wrap width="narrow" className="flex flex-col gap-4">
            <Title>
              <AboutTitle content={content} fallback="Who we are" />
            </Title>
            <ProseText id="about.body" value={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "faq") && content.faq.length > 0 ? (
        <Section id="faq">
          <Wrap className="flex flex-col gap-9">
            <Head section="faq" title="Before you call" />
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
  const heroPicture = usePictureShown(content.hero.image)

  return (
    <>
      <SiteNav content={content} sections={sections} />

      {/* Words squeezed to the side; the wall of pictures does the work. */}
      <Section id="top" className="py-10">
        <Wrap
          className={cn(
            "grid gap-8",
            heroPicture && "lg:grid-cols-[1fr_2fr] lg:items-end"
          )}
        >
          <div className={cn("flex flex-col gap-3", !heroPicture && "max-w-[760px]")}>
            <Tagline content={content} />
            <Title as="h1" className="text-[clamp(1.8rem,4vw,2.8rem)]">
              <Headline content={content} />
            </Title>
            <Sub content={content} />
            {content.hero.ctaLabel ? (
              <div className="pt-1">{heroCta(content)}</div>
            ) : null}
          </div>
          {heroPicture ? (
            <Picture
              src={content.hero.image}
              alt={content.name}
              ratio="16/9"
              slot="hero.image"
            />
          ) : null}
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
            <Head section="products" title="For sale" />
            <ProductGrid products={content.products} columns={4} ratio="1/1" />
          </Wrap>
        </Section>
      ) : null}

      {has(sections, "about") && content.about.body ? (
        <Section>
          <Wrap width="narrow" className="flex flex-col gap-4">
            <Title>
              <AboutTitle content={content} fallback="About" />
            </Title>
            <ProseText id="about.body" value={content.about.body} />
          </Wrap>
        </Section>
      ) : null}

      {showContact(sections, content) ? (
        <Section id="contact" tone="soft">
          <Wrap className="flex flex-col gap-7">
            <Title>{heading("contact", "Get in touch")}</Title>
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

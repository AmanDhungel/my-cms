import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SiteRenderer } from "@/components/sites/site-renderer"
import { safeHref } from "@/lib/security/safe-url"
import { findPublishedSite } from "@/lib/site-server"
import { publishedContent } from "@/lib/site-slots"
import { sectionsOf } from "@/lib/site-templates"
import { toExtraSlots, toSiteContent } from "@/models/site"

/**
 * A tenant's public website.
 *
 * Nobody ever types this path. The proxy rewrites `balaju.localhost/` onto
 * `/sites/balaju`, so the address bar keeps saying the subdomain while this
 * renders underneath it.
 *
 * No session is read here and none is wanted: it is a public page for
 * strangers, and the auth matcher deliberately leaves it alone.
 */

export async function generateMetadata({
  params,
}: PageProps<"/sites/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const site = await findPublishedSite(slug)

  if (!site) return { title: "Not found" }

  const content = toSiteContent(site.content)
  // Only an absolute http(s) picture is ever named in the share preview.
  const shareImage = safeHref(content.hero.image)

  return {
    title: content.tagline ? `${content.name} — ${content.tagline}` : content.name,
    description:
      content.description ?? content.hero.sub ?? content.tagline ?? undefined,
    openGraph: {
      title: content.name,
      description: content.description ?? content.hero.sub ?? undefined,
      images: shareImage ? [shareImage] : undefined,
    },
    // A tenant site is its own thing; nothing here should read as EMS.
    robots: { index: true, follow: true },
  }
}

export default async function TenantSitePage({
  params,
}: PageProps<"/sites/[slug]">) {
  const { slug } = await params
  const site = await findPublishedSite(slug)

  // Unpublished, blocked and never-existed all end here on purpose: a
  // subdomain should not reveal that it is taken but not ready.
  if (!site) notFound()

  return (
    <SiteRenderer
      template={site.template}
      // Only what this template shows: the renderer's props are serialised
      // into the HTML, so anything else would be readable in the source.
      content={publishedContent(
        toSiteContent(site.content),
        sectionsOf(site.template)
      )}
      extraSlots={toExtraSlots(site.extraSlots)}
      mode="published"
      className="min-h-screen"
    />
  )
}

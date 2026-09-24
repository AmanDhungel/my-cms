import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SiteRenderer } from "@/components/sites/site-renderer"
import { findPublishedSite } from "@/lib/site-server"
import { toSiteContent } from "@/models/site"

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

  return {
    title: content.tagline ? `${content.name} — ${content.tagline}` : content.name,
    description:
      content.description ?? content.hero.sub ?? content.tagline ?? undefined,
    openGraph: {
      title: content.name,
      description: content.description ?? content.hero.sub ?? undefined,
      images: content.hero.image ? [content.hero.image] : undefined,
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
      content={toSiteContent(site.content)}
      className="min-h-screen"
    />
  )
}

import type { Metadata } from "next"
import { headers } from "next/headers"

import { SiteBuilder } from "@/components/dashboard/site/site-builder"
import { requirePageRole } from "@/lib/auth/page-guards"

export const metadata: Metadata = { title: "Your website · EMS" }

/**
 * The site builder.
 *
 * Owner only: what the business says about itself in public is the owner's to
 * write, the same rule the Payments and Expenses pages keep.
 */
export default async function SitePage() {
  await requirePageRole("owner")

  /*
   * The port, so the builder can show a link that actually opens.
   *
   * In development the site lives at `slug.localhost:3000`, and the port is
   * only knowable from the request — hard-coding 3000 would print a dead link
   * for anyone running on another one. In production there is no port and
   * this comes back null, which is what we want.
   */
  const host = (await headers()).get("host") ?? ""
  const port = host.split(":")[1] ?? null

  return <SiteBuilder port={port} />
}
